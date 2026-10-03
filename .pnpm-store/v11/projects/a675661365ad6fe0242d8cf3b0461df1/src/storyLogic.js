export function createInitialState(schema) {
  const state = Object.fromEntries(
    Object.entries(schema.properties).map(([name, definition]) => [
      name,
      structuredClone(definition.default),
    ]),
  )
  return { ...state, completed_routes: [] }
}

function readPath(object, path) {
  return path.split('.').reduce((value, key) => value?.[key], object)
}

function stateDefinition(schema, path) {
  return path.split('.').reduce((definition, key) => {
    return definition?.properties?.[key] ?? definition?.additionalProperties
  }, schema)
}

function applyEffects(state, effects = {}, schema) {
  const updated = structuredClone(state)

  for (const [path, effect] of Object.entries(effects)) {
    const keys = path.split('.')
    const field = keys.pop()
    const parent = keys.reduce((object, key) => (object[key] ??= {}), updated)
    const current = parent[field]
    let value = effect.operation === 'add' ? (current ?? 0) + effect.value : effect.value
    const definition = stateDefinition(schema, path)

    if (typeof value === 'number') {
      if (definition?.minimum !== undefined) value = Math.max(definition.minimum, value)
      if (definition?.maximum !== undefined) value = Math.min(definition.maximum, value)
    }

    parent[field] = value
  }

  return updated
}

function matchesCondition(expression, state) {
  if (expression.all) return expression.all.every((part) => matchesCondition(part, state))
  if (expression.any) return expression.any.some((part) => matchesCondition(part, state))
  const actual = readPath(state, expression.field)
  if (expression.operator === '==') return actual === expression.value
  if (expression.operator === '>=') return actual >= expression.value
  return false
}

export function resolveChoice(playerState, choice, schema) {
  let updated = applyEffects(playerState, choice.effects, schema)
  let nextNode = choice.next_node
  let conditionMatched = null
  const changedPaths = new Set(Object.keys(choice.effects ?? {}))

  if (choice.condition) {
    const observed = choice.condition.evaluation === 'before_effects'
      ? playerState
      : updated
    conditionMatched = matchesCondition(choice.condition.expression, observed)
    const branch = conditionMatched
      ? choice.condition.on_true
      : choice.condition.on_false
    updated = applyEffects(updated, branch.effects, schema)
    Object.keys(branch.effects ?? {}).forEach((path) => changedPaths.add(path))
    nextNode = branch.next_node ?? nextNode
  }

  const changes = [...changedPaths]
    .map((path) => ({ path, before: readPath(playerState, path), after: readPath(updated, path) }))
    .filter(({ before, after }) => before !== after)

  return { playerState: updated, nextNode, changes, conditionMatched }
}

export function recordCompletedRoute(playerState, characterId) {
  if (!characterId || playerState.completed_routes.includes(characterId)) return playerState
  return {
    ...playerState,
    completed_routes: [...playerState.completed_routes, characterId],
  }
}
