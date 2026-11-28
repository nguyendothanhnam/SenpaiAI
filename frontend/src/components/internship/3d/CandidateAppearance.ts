import * as THREE from 'three'

export type CandidateGender = 'male' | 'female'

/** Appearance only: retain the articulated avatar, existing materials and rig. */
export function createCandidateAppearance(parts: {
  head: THREE.Group
  jacket: THREE.Mesh
  tie: THREE.Mesh
  hair: THREE.Object3D
}) {
  const { head, jacket, tie, hair } = parts
  const femaleHair = new THREE.Group()
  femaleHair.name = 'Candidate_FemaleHair'

  const hairMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    roughness: 0.9,
  })

  // Female rear bun & back hair positioned proud of head back plane (-0.12)
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.08), hairMat)
  back.position.set(0, 0.035, -0.135)
  back.castShadow = true

  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), hairMat)
  bun.position.set(0, 0.11, -0.21)
  bun.castShadow = true

  const crown = new THREE.Mesh(new THREE.BoxGeometry(0.284, 0.08, 0.28), hairMat)
  crown.position.set(0, 0.142, 0.005)
  crown.castShadow = true

  femaleHair.add(back, bun, crown)
  femaleHair.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.frustumCulled = false
    }
  })
  head.add(femaleHair)

  const featureMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.8 })
  for (const x of [-0.055, 0.055]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.01), featureMat)
    eye.position.set(x, 0.015, 0.126)
    eye.frustumCulled = false
    head.add(eye)
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.009, 0.008), featureMat)
  mouth.position.set(0, -0.065, 0.126)
  mouth.frustumCulled = false
  head.add(mouth)

  const originalJacketScale = jacket.scale.clone()
  const originalHairScale = hair.scale.clone()

  const setGender = (gender: CandidateGender) => {
    tie.visible = gender === 'male'
    hair.visible = gender === 'male'
    femaleHair.visible = gender === 'female'
    jacket.scale.copy(originalJacketScale)
    hair.scale.copy(originalHairScale)
    if (gender === 'female') jacket.scale.x *= 0.94
    head.userData.candidateGender = gender
  }
  setGender('male')
  return { setGender, femaleHair }
}
