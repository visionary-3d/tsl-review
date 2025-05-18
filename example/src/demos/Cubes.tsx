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
import { instanceIndex, positionLocal, storage, wgslFn, color, uniform } from 'three/tsl'
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

    const typeSize = 3
    const size = count
    const arrayBuffer = new THREE.StorageInstancedBufferAttribute(new Float32Array(size * typeSize), typeSize)

    // tsl -> gpu level

    const buffer = storage(arrayBuffer, 'vec3', size)

    const computeInitOrder = wgslFn(/* wgsl */ `

			fn compute(
				buffer: ptr<storage, array<vec3f>, read_write>,
				count: f32,
				index: u32,
			) -> void {
				let cubeDim = ceil(pow(count, 1.0 / 3.0));
				let x = f32(index) % cubeDim;
				let y = floor(f32(index) / cubeDim) % cubeDim;
				let z = floor(f32(index) / (cubeDim * cubeDim));

				let pos_x = (x / (cubeDim - 1.0)) * 2.0 - 1.0;
				let pos_y = (y / (cubeDim - 1.0)) * 2.0 - 1.0;
				let pos_z = (z / (cubeDim - 1.0)) * 2.0 - 1.0;

				buffer[index] = vec3f(pos_x, pos_y, pos_z);
			}

    `)

    // compute shader
    const computeNode = computeInitOrder({
      buffer: buffer,
      count: count,
      index: instanceIndex,
    }).compute(count, [8])

    // vertex shader
    const positionNode = positionLocal.add(buffer.element(instanceIndex))

    // fragment shader
    const colorNode = color('#aaf')

    return { colorNode, positionNode, timeUniform, computeNode, arrayBuffer }
  }, [])

  async function compute() {
    await renderer.computeAsync(computeNode)
    const output = new Float32Array(await renderer.getArrayBufferAsync(arrayBuffer))
    console.log(output)
  }

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
