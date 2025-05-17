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
import { useMemo, useRef, useEffect } from 'react'
import {
  instanceIndex,
  positionLocal,
  storage,
  Fn,
  color,
  uniform,
  float,
  ceil,
  pow,
  mod,
  floor,
  vec4,
} from 'three/tsl'
import * as THREE from 'three/webgpu'

declare module '@react-three/fiber' {
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as any)

interface InstancedSpheresProps {
  count?: number
}

function InstancedSpheres({ count = 1000 }: InstancedSpheresProps) {
  const { gl } = useThree()
  const renderer = gl as unknown as THREE.WebGPURenderer
  const meshRef = useRef<THREE.InstancedMesh>(null)

  useEffect(() => {
    if (!meshRef.current) return
    compute()
  }, [])

  const { colorNode, positionNode, timeUniform, computeNode, arrayBuffer } = useMemo(() => {
    const timeUniform = uniform(0)

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
      buffer.element(instanceIndex).assign(newPosition)
    })

    // compute shader
    const computeNode = computeInitOrder().compute(size, [8])

    // vertex shader
    const positionNode = positionLocal.add(buffer.element(instanceIndex))

    // fragment shader
    const colorNode = color('#aaf')

    return { colorNode, positionNode, timeUniform, computeNode, arrayBuffer }
  }, [])

  async function compute() {
    await renderer.computeAsync(computeNode)
    // const output = new Float32Array(await renderer.getArrayBufferAsync(arrayBuffer))
    // console.log(output)
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
    </Canvas>
  )
}
