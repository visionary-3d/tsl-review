import {
  Canvas,
  extend,
  type ThreeToJSXElements,
  useFrame,
  type ThreeElements,
  type ThreeEvent,
  useThree,
} from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { easing } from 'maath'
import { useMemo, useState, useRef, useEffect } from 'react'
import {
  instanceIndex,
  positionLocal,
  storage,
  Fn,
  wgslFn,
  color,
  mix,
  sin,
  cos,
  time,
  uniform,
  vec3,
  attribute,
  smoothstep,
  float,
  ceil,
  pow,
  mod,
  floor,
  dot,
  vec4,
} from 'three/tsl'
import * as THREE from 'three/webgpu'

declare module '@react-three/fiber' {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as any)

const exampleWGSL = /* wgsl */`

  let cubeDim = ceil(pow(uniforms.instanceCount, 1.0/3.0));
  let x = f32(index) % cubeDim;
  let y = floor(f32(index) / cubeDim) % cubeDim;
  let z = floor(f32(index) / (cubeDim * cubeDim));

  let pos_x = (x / (cubeDim - 1.0)) * 2.0 - 1.0;
  let pos_y = (y / (cubeDim - 1.0)) * 2.0 - 1.0;
  let pos_z = (z / (cubeDim - 1.0)) * 2.0 - 1.0;

`

interface InstancedSpheresProps {
  count?: number
  radius?: number
  bounds?: number
  speed?: number
}

function InstancedSpheres({ count = 1000, radius = 0.1, bounds = 10, speed = 0.001 }: InstancedSpheresProps) {
  const { gl } = useThree()
  const renderer = gl as unknown as THREE.WebGPURenderer
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const [clicked, setClicked] = useState<number | null>(null)
  const [hovered, setHovered] = useState<number | null>(null)

  const [instanceData] = useMemo(() => {
    const instanceDataArray = new Float32Array(count * 4)

    for (let i = 0; i < count; i++) {
      // Store random values for each instance (frequency, phase, amplitude)
      instanceDataArray[i * 4 + 0] = 0.5 + Math.random() // frequency multiplier
      instanceDataArray[i * 4 + 1] = Math.random() * Math.PI * 2 // random phase
      instanceDataArray[i * 4 + 2] = 0.3 + Math.random() * 0.7 // amplitude multiplier
      instanceDataArray[i * 4 + 3] = Math.random() // additional variation
    }
    return [instanceDataArray]
  }, [count, bounds])

  useEffect(() => {
    if (!meshRef.current) return

    if (meshRef.current.geometry) {
      const instancedGeometry = meshRef.current.geometry as THREE.InstancedBufferGeometry
      instancedGeometry.setAttribute('instanceData', new THREE.InstancedBufferAttribute(instanceData, 4))
    }

      compute()
  }, [instanceData])

  const { colorNode, positionNode, timeUniform, computeNode, arrayBuffer } = useMemo(() => {
    const timeUniform = uniform(0)
    const t = timeUniform

    const typeSize = 4
    const size = count
    const arrayBuffer = new THREE.StorageInstancedBufferAttribute(new Float32Array(size * typeSize), typeSize)

    // tsl -> gpu level

    const buffer = storage(arrayBuffer, 'vec4', size)

    const computeInitOrder = Fn(() => {
      const cubeDim = float(ceil(pow(count, 1.0 / 3.0)))
      const index = float(instanceIndex)

      const x = mod(index, cubeDim)
      const y = mod(floor(index.div(cubeDim)), cubeDim)
      const z = floor(index.div(cubeDim.mul(cubeDim)))

      function getInCubeBounds(node: THREE.TSL.ShaderNodeObject<THREE.Node>) {
        return node
          .div(cubeDim.sub(float(1)))
          .mul(float(2))
          .sub(float(1))
      }

      const newPosition = vec4(getInCubeBounds(x), getInCubeBounds(y), getInCubeBounds(z), 0)

      // const offset = buffer.element(instanceIndex)

      // const direction = vec3(1, 1, 1)
      // const posAlongWave = dot(offset, direction);

      // const displacement = float(1).mul(sin(posAlongWave.mul(float(1)).add(t)));

      // const direction = vec3(1, 1, 1)
      // const posAlongWave = dot(offset, direction)

      // const displacement = float(0.2).mul(sin(posAlongWave.mul(float(1)).add(t)))
      // buffer.element(instanceIndex).assign(newPosition.add(displacement))

      buffer.element(instanceIndex).assign(newPosition)

    })

    const computeNode = computeInitOrder().compute(size, [8])



    const positionNode = positionLocal.add(buffer.element(instanceIndex))

    const baseColorNode = color('#aaf')

    const colorNode = baseColorNode

    return { colorNode, positionNode, timeUniform, computeNode, arrayBuffer }
  }, [speed])

  async function compute() {
    await renderer.computeAsync(computeNode)
    const output = new Float32Array(await renderer.getArrayBufferAsync(arrayBuffer))
    console.log(output)
  }

  // Update time uniform on each frame and handle hover effect
  useFrame((state) => {
    if (timeUniform) {
      timeUniform.value = state.clock.getElapsedTime()
    }
  })

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.2, 0.2, 0.2]} />
      <meshPhysicalNodeMaterial colorNode={colorNode} positionNode={positionNode} vertexColors={true} />
    </instancedMesh>
  )
}

export default function App() {
  return (
    <Canvas
      gl={async (props) => {
        const renderer = new THREE.WebGPURenderer(props as any)
        await renderer.init()
        return renderer
      }}>
      <OrbitControls />
      <ambientLight intensity={0.5} />
      <directionalLight position={[2, 4, 5]} intensity={2} />
      <directionalLight position={[-5, 3, 0]} intensity={1} />
      <InstancedSpheres />
      <gridHelper args={[20, 20]} />
      {/* <axesHelper args={[5]} /> */}
    </Canvas>
  )
}
