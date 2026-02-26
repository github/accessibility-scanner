// - this exists because it looks like there's no straight-forward
//   way to mock the dynamic import function, so mocking this instead
//   (also, if it _is_ possible to mock the dynamic import,
//   there's the risk of altering/breaking the behavior of imports
//   across the board - including non-dynamic imports)
//
// - also, vitest has a limitation on mocking:
//   https://vitest.dev/guide/mocking/modules.html#mocking-modules-pitfalls
//
// - basically if a function is called by another function in the same file
//   it can't be mocked. So this was extracted into a separate file
//
// - one thing to note is vitest does the same thing here:
//   https://github.com/vitest-dev/vitest/blob/main/test/core/src/dynamic-import.ts
// - and uses that with tests here:
//   https://github.com/vitest-dev/vitest/blob/main/test/core/test/mock-internals.test.ts#L27
//
// - so this looks like a reasonable approach
export async function dynamicImport(path: string) {
  return import(path)
}
