// - this exist as a test to verify that loading plugins
//   via js files still works and there are no regressions

export default async function TestJsFilePluginLoad({ page, addFinding } = {}) {
  console.log('testing plugin load using js file')
}

export const name = 'test-js-file-plugin-load'
