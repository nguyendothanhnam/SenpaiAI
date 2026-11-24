from collections import Counter
import json
from pathlib import Path
import shutil

import pytest
import torch
from torch.utils.data import DataLoader, Subset, TensorDataset

import ml.kanji_recognizer as runtime
from ml.kanji_labels import SUPPORTED_KANJI, get_metadata
from ml.kanji_model import KanjiCNN
from ml.scripts import promote_kanji_model as deployment
from ml.train_kanji_model import cap_training_subset, evaluate, load_initial_weights


def save_pair(folder, labels):
    folder.mkdir(parents=True, exist_ok=True)
    torch.save(KanjiCNN(len(labels)).state_dict(), folder / 'kanji_model.pt')
    (folder / 'label_map.json').write_text(json.dumps(labels), encoding='utf-8')


@pytest.fixture
def artifacts(tmp_path, monkeypatch):
    torch.set_num_threads(2)
    source, active = tmp_path / 'source', tmp_path / 'active'
    save_pair(source, {'日': 0, '才': 1})
    save_pair(active, {'日': 0})
    monkeypatch.setattr(deployment, 'SUPPORTED_KANJI', ['日', '才'])
    return source, active


def test_promotion_preserves_both_old_artifacts_and_is_idempotent(artifacts):
    source, active = artifacts
    hashes = {name: deployment.digest(active / name) for name in deployment.ARTIFACTS}
    report = deployment.promote(source, active)
    assert report['classes'] == 2
    backup = Path(report['backup_dir'])
    for name, previous in hashes.items():
        assert deployment.digest(backup / name) == previous
        assert deployment.digest(active / name) == deployment.digest(source / name)
    assert deployment.promote(source, active)['changed'] is False
    assert len(list((active / 'backups').iterdir())) == 1


@pytest.mark.parametrize('mapping', [{'日': 0}, {'日': 0, '才': 0}, {'日': 0, '才': 2}, {'日': False, '才': 1}])
def test_incomplete_or_invalid_labels_cannot_replace_active_model(artifacts, mapping):
    source, active = artifacts
    before = {name: deployment.digest(active / name) for name in deployment.ARTIFACTS}
    (source / 'label_map.json').write_text(json.dumps(mapping), encoding='utf-8')
    with pytest.raises(ValueError):
        deployment.promote(source, active)
    assert before == {name: deployment.digest(active / name) for name in deployment.ARTIFACTS}


def test_failed_install_restores_the_original_pair(artifacts, monkeypatch):
    source, active = artifacts
    before = {name: deployment.digest(active / name) for name in deployment.ARTIFACTS}
    replace = deployment.os.replace
    def fail_labels(source_path, destination):
        if Path(destination).name == 'label_map.json':
            raise OSError('simulated write failure')
        return replace(source_path, destination)
    monkeypatch.setattr(deployment.os, 'replace', fail_labels)
    with pytest.raises(OSError, match='simulated'):
        deployment.promote(source, active)
    assert before == {name: deployment.digest(active / name) for name in deployment.ARTIFACTS}


def test_runtime_keeps_previous_model_until_both_replacement_files_are_ready(artifacts, monkeypatch):
    source, active = artifacts
    previous = runtime.KanjiRecognizer(active / 'kanji_model.pt', active / 'label_map.json')
    monkeypatch.setattr(runtime, 'DEFAULT_MODEL_PATH', active / 'kanji_model.pt')
    monkeypatch.setattr(runtime, 'DEFAULT_LABEL_MAP_PATH', active / 'label_map.json')
    monkeypatch.setattr(runtime, '_recognizer', previous)
    monkeypatch.setattr(runtime, '_loaded_signature', runtime._artifact_signature())
    shutil.copy2(source / 'kanji_model.pt', active / 'kanji_model.pt')
    assert runtime.get_model_info()['total_classes'] == 1
    assert runtime._recognizer is previous
    shutil.copy2(source / 'label_map.json', active / 'label_map.json')
    assert runtime.get_model_info()['total_classes'] == 2
    assert runtime._recognizer is not previous
    assert len(previous.index_to_label) == 1


def test_training_cap_is_balanced_deterministic_and_excludes_validation_indices():
    targets = [0] * 8 + [1] * 8 + [2] * 8
    subset = Subset(list(range(24)), [index for index in range(24) if index % 4])
    capped = cap_training_subset(subset, targets, 3)
    assert Counter(targets[index] for index in capped.indices) == {0: 3, 1: 3, 2: 3}
    assert set(capped.indices) <= set(subset.indices)
    assert capped.indices == cap_training_subset(subset, targets, 3).indices
    assert cap_training_subset(subset, targets, 0) is subset


def test_initialization_rejects_another_class_order_before_loading_weights(tmp_path):
    (tmp_path / 'label_map.json').write_text(json.dumps({'日': 1, '才': 0}), encoding='utf-8')
    with pytest.raises(ValueError, match='indices'):
        load_initial_weights(None, tmp_path, {'日': 0, '才': 1}, 'cpu')


def test_validation_computes_per_level_metrics_in_one_pass():
    class CountCalls(torch.nn.Module):
        def __init__(self):
            super().__init__()
            self.calls = 0
        def forward(self, images):
            self.calls += 1
            return images
    model = CountCalls()
    loader = DataLoader(TensorDataset(torch.tensor([[5., 0.], [0., 5.], [5., 0.]]), torch.tensor([0, 1, 0])), batch_size=2)
    result = evaluate(model, loader, torch.nn.CrossEntropyLoss(), 'cpu', {0: 'N5', 1: 'N3'})
    assert result['accuracy'] == 1
    assert result['by_level'] == {'N5': 1, 'N3': 1}
    assert model.calls == 2


def test_deployed_model_has_outputs_for_every_dictionary_character():
    torch.set_num_threads(2)
    info = runtime.get_model_info()
    assert info['available']
    assert info['dictionary_classes'] == 612
    assert info['total_classes'] == 612
    assert set(info['supported_kanji']) == set(SUPPORTED_KANJI)
    assert Counter(get_metadata(char)['jlpt'] for char in info['supported_kanji']) == {'N5': 79, 'N4': 166, 'N3': 367}
    assert info['supported_jlpt'] == ['N5', 'N4', 'N3']
