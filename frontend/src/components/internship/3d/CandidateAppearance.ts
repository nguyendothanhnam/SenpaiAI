import * as THREE from 'three'

export type CandidateGender = 'male' | 'female'

/** Appearance only: retain the articulated avatar, existing materials and rig. */
export function createCandidateAppearance(parts: {
  head: THREE.Group
  jacket: THREE.Mesh
  tie: THREE.Mesh
  hair: THREE.Mesh
}) {
  const { head, jacket, tie, hair } = parts
  const femaleHair = new THREE.Group()
  femaleHair.name = 'Candidate_FemaleHair'
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.24, 0.07), hair.material)
  back.position.set(0, 0.035, -0.12)
  const bun = new THREE.Mesh(new THREE.SphereGeometry(0.095, 12, 10), hair.material)
  bun.position.set(0, 0.11, -0.20)
  const fringe = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.065, 0.025), hair.material)
  fringe.position.set(0, 0.105, 0.125)
  femaleHair.add(back, bun, fringe)
  head.add(femaleHair)
  for (const x of [-0.055, 0.055]) {
    const eye = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.01), hair.material)
    eye.position.set(x, 0.015, 0.125)
    head.add(eye)
  }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.009, 0.008), hair.material)
  mouth.position.set(0, -0.065, 0.125)
  head.add(mouth)
  const originalJacketScale = jacket.scale.clone()
  const originalHairScale = hair.scale.clone()
  const setGender = (gender: CandidateGender) => {
    tie.visible = gender === 'male'
    femaleHair.visible = gender === 'female'
    jacket.scale.copy(originalJacketScale)
    hair.scale.copy(originalHairScale)
    if (gender === 'female') jacket.scale.x *= 0.94
    head.userData.candidateGender = gender
  }
  setGender('male')
  return { setGender, femaleHair }
}
