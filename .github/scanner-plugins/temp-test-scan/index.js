
// - this exist as a test to verify that loading plugins
//   via js files still works and there are no regressions

export default async function JSFilePluginLoadTest({ page, addFinding } = {}) {
  console.log('testing loading plugin using js file')
}

export const name = 'js-file-plugin-load-test'
