import React from 'react'

const element = <span>real react addon</span>
const root = document.querySelector('#root')

if (!root) {
  throw new Error('real react fixture root not found')
}

root.textContent = `${element.props.children} ${React.version}`
