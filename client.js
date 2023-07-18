const scope = document.querySelectorAll(`[data-scope]`)[0];

function createState(initialState = {}) {
  const $bindings = scope.querySelectorAll('[data-binding]');

  const state = new Proxy(initialState, {
    set: (target, key, value) => {
      target[key] = value;

      const elements = Array.from($bindings).filter((node) => {
        return node.dataset.binding === key;
      });

      elements.forEach((element) => {
        element.textContent = value;
      });

      return true;
    },
  });

  // Initial bindings
  $bindings.forEach(($binding) => {
    const key = $binding.dataset.binding;
    if (typeof state[key] === 'undefined') return;
    $binding.textContent = state[key];
  });

  return state;
}

initializers?.forEach?.((_init) => {
  _init?.(scope, { createState });
});
