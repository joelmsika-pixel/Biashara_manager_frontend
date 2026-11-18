import assert from 'node:assert/strict'
import { test } from 'node:test'
import picomatch from 'picomatch'

test('collapses repeated extglobs with a wildcard branch', () => {
  const pattern = '+(*a)'
  const matcher = picomatch.makeRe(pattern)

  assert.equal(matcher.source, '^(?:(?=.)(?:[^/]*?a))$')
  assert.equal(picomatch.isMatch('aaa', pattern), true)
  assert.equal(picomatch.isMatch('a/b', pattern), false)
})

test('preserves slash-delimited repeated extglobs', () => {
  assert.equal(picomatch.isMatch('src/a/src/b/', '+(src/*/)'), true)
})
