import base64
from io import BytesIO
from pathlib import Path
import tempfile
import unittest
from unittest.mock import Mock

import torch
from PIL import Image, ImageDraw
from ml.kanji_recognizer import KanjiRecognizer, preprocess_image_data, preprocess_pil_image


def encoded(image):
    data = BytesIO()
    image.save(data, format="PNG")
    return "data:image/png;base64," + base64.b64encode(data.getvalue()).decode("ascii")


class KanjiPreprocessingTest(unittest.TestCase):
    def test_blank_input_always_returns_zero_tensor_not_pillow_image(self):
        tensor = preprocess_image_data(encoded(Image.new("L", (256, 256), 255)))
        self.assertIsInstance(tensor, torch.Tensor)
        self.assertEqual(tuple(tensor.shape), (1, 1, 64, 64))
        self.assertEqual(tensor.dtype, torch.float32)
        self.assertEqual(tensor.sum().item(), 0)

    def test_empty_canvas_does_not_run_model_or_raise(self):
        with tempfile.TemporaryDirectory() as directory:
            model = KanjiRecognizer(Path(directory) / "missing.pt", Path(directory) / "missing.json")
        model.model = Mock()
        model.index_to_label = {0: "\u65e5"}
        self.assertEqual(model.predict(encoded(Image.new("L", (256, 256), 255))), [])
        self.assertEqual(model.last_error, "empty_canvas")
        model.model.assert_not_called()

    def test_transparent_background_matches_white_background(self):
        transparent = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        opaque = Image.new("RGBA", (256, 256), (255, 255, 255, 255))
        for image in (transparent, opaque):
            ImageDraw.Draw(image).line([(80, 45), (80, 210), (180, 210)], fill=(0, 0, 0, 255), width=10)
        self.assertTrue(torch.equal(preprocess_image_data(encoded(transparent)), preprocess_image_data(encoded(opaque))))

    def test_fully_transparent_black_pixels_are_not_ink(self):
        self.assertEqual(preprocess_image_data(encoded(Image.new("RGBA", (256, 256), (0, 0, 0, 0)))).sum().item(), 0)

    def test_nonempty_canvas_has_normalized_finite_ink_and_configurable_size(self):
        image = Image.new("L", (256, 256), 255)
        ImageDraw.Draw(image).line([(20, 40), (110, 180)], fill=0, width=9)
        tensor = preprocess_pil_image(image, 128)
        self.assertEqual(tuple(tensor.shape), (1, 1, 128, 128))
        self.assertTrue(torch.isfinite(tensor).all())
        self.assertGreater(tensor.sum().item(), 0)
        self.assertGreaterEqual(tensor.min().item(), 0)
        self.assertLessEqual(tensor.max().item(), 1)

    def test_invalid_image_is_rejected_without_inference(self):
        self.assertIsNone(preprocess_image_data("not base64!"))
        self.assertIsNone(preprocess_image_data("data:image/png;base64,dGVzdA=="))


if __name__ == "__main__":
    unittest.main()
