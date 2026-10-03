import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createInitialState, resolveChoice } from './storyLogic.js'

const story = JSON.parse(readFileSync(new URL('../../data/interactive/nodes.json', import.meta.url)))
const schema = JSON.parse(readFileSync(new URL('../../data/interactive/state_schema.json', import.meta.url)))
const nodes = Object.fromEntries(story.nodes.map((node) => [node.id, node]))
const negotiate = nodes.S04.choices.find((choice) => choice.id === 'S04_C')

test('only two playable routes exist and all data links resolve', () => {
  assert.deepEqual(nodes.P01.next, ['K01', 'J01'])
  assert.equal(story.nodes.some((node) => node.character === 'alang'), false)
  assert.equal('alang' in createInitialState(schema), false)
  for (const node of story.nodes) {
    for (const id of node.next) assert.ok(nodes[id], `${node.id} -> ${id}`)
    for (const choice of node.choices) {
      assert.ok(nodes[choice.next_node])
      for (const branch of ['on_true', 'on_false']) {
        const target = choice.condition?.[branch]?.next_node
        if (target) assert.ok(nodes[target])
      }
    }
  }
})

test('true ending depends on current viewpoint, not unplayed characters', () => {
  for (const [viewpoint, reputation, nameValue, expected] of [
    ['kangyan', 60, 0, 'END03'], ['kangyan', 59, 3, 'END02'],
    ['ajiu', 50, 2, 'END03'], ['ajiu', 100, 1, 'END02'],
    [undefined, 100, 3, 'END02'], ['alang', 100, 3, 'END02'],
  ]) {
    const state = createInitialState(schema)
    state.storyFlags.viewpoint = viewpoint
    state.reputation = reputation
    state.ajiu.nameValue = nameValue
    assert.equal(resolveChoice(state, negotiate, schema).nextNode, expected)
  }
})

test('both viewpoints can reach the true ending through real choices', () => {
  for (const choices of [
    ['P01_A', 'K01_A', 'K03_A', 'K04_B'],
    ['P01_B', 'J01_A', 'J02_A', 'J03_A', 'J04_A'],
  ]) {
    let state = createInitialState(schema)
    for (const id of choices) {
      const choice = story.nodes.flatMap((node) => node.choices).find((item) => item.id === id)
      state = resolveChoice(state, choice, schema).playerState
    }
    assert.equal(resolveChoice(state, negotiate, schema).nextNode, 'END03')
  }
})

test('unsupported comparisons fail closed and equality does not coerce input', () => {
  const state = createInitialState(schema)
  for (const expression of [
    { field: 'reputation', operator: 'unsupported', value: 0 },
    { field: 'reputation', operator: '==', value: '50' },
  ]) {
    const choice = structuredClone(negotiate)
    choice.condition.expression = expression
    assert.equal(resolveChoice(state, choice, schema).nextNode, 'END02')
  }
})
