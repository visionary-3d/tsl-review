import { lazy } from 'react'

const Cubes = { Component: lazy(() => import('./Cubes')) }

export { Cubes }
