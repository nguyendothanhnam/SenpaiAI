import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import ts from 'typescript'
import * as THREE from 'three'

const require = createRequire(import.meta.url)
const code = ts.transpileModule(readFileSync(new URL('../src/components/internship/3d/CandidateAppearance.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
const module = { exports: {} }
new Function('require', 'module', 'exports', code)(require, module, module.exports)
const { createCandidateAppearance } = module.exports

function avatar() {
  const head = new THREE.Group(), jacket = new THREE.Mesh(), tie = new THREE.Mesh(), hair = new THREE.Mesh()
  head.add(hair)
  const torsoPosition = jacket.position.set(0, 0.26, 0).clone()
  const appearance = createCandidateAppearance({ head, jacket, tie, hair })
  return { head, jacket, tie, hair, torsoPosition, appearance }
}
test('female outfit has its own attached hairstyle and removes the tie without moving the rig', () => {
  const a = avatar()
  a.appearance.setGender('female')
  assert.equal(a.appearance.femaleHair.visible, true)
  assert.equal(a.appearance.femaleHair.parent, a.head)
  assert.equal(a.tie.visible, false)
  assert.equal(a.head.userData.candidateGender, 'female')
  assert.equal(a.jacket.scale.x, 0.94)
  assert.ok(a.jacket.position.equals(a.torsoPosition))
  assert.equal(a.appearance.femaleHair.children.length, 3)
})
test('switching back and forth reuses the same meshes and restores the original proportions', () => {
  const a = avatar(), count = a.head.children.length
  for (let i = 0; i < 20; i++) {
    a.appearance.setGender('female'); a.appearance.setGender('male')
  }
  assert.equal(a.head.children.length, count)
  assert.equal(a.tie.visible, true)
  assert.equal(a.appearance.femaleHair.visible, false)
  assert.deepEqual(a.jacket.scale.toArray(), [1, 1, 1])
  assert.deepEqual(a.hair.scale.toArray(), [1, 1, 1])
  assert.equal(a.head.userData.candidateGender, 'male')
})
