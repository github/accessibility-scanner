// - this exists because I'm not sure how to mock
//   the dynamic import function, so mocking this instead
// - also, vitest has a limitation on mocking:
//   https://vitest.dev/guide/mocking/modules.html#mocking-modules-pitfalls
// - basically if a function is called by another function in the same file
//   it can't be mocked. So this was extracted into a separate file
export async function dynamicImport(path: string) {
  return import(path)
}
