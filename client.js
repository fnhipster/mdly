function init(root = document) {
  root.querySelectorAll('a').forEach((d) => {
    d.addEventListener('click', (e) => {
      const d = e.currentTarget;
      const current = window.location.pathname;
      const next = d.getAttribute('href');

      // Only handle internal links
      if (!next.startsWith('/')) return;

      // Prevent default behavior
      e.preventDefault();

      // Only handle new requests
      if (next === current) return;

      setRoute(next);
    });
  });
}

async function setRoute(next) {
  // Get requested page
  const response = await fetch(next);
  const $vdom = document.createElement('html');
  $vdom.innerHTML = await response.text();

  const $currentScope = document.querySelector('script[data-scopes]');
  const $nextScope = $vdom.querySelector('script[data-scopes]');

  // Update DOM
  const scope = {
    current: JSON.parse($currentScope?.dataset.scopes),
    next: JSON.parse($nextScope?.dataset.scopes),
  };

  const title = $vdom.querySelector('title').innerText;

  if (title) document.title = title;

  // Replace current scope
  $currentScope.replaceWith($nextScope);

  // Remove old styles
  diff(scope.current.styles, scope.next.styles).forEach((_scope) => {
    const $style = document.querySelector(`style[data-scope="${_scope}"]`);
    $style?.remove();
  });

  // Add new styles
  diff(scope.next.styles, scope.current.styles).forEach((_scope) => {
    const $style = $vdom.querySelector(`style[data-scope="${_scope}"]`);
    if ($style) document.head.appendChild($style);
  });

  // Update Template
  const template =
    scope.current.templates.find(
      (s) => s === scope.next.templates[scope.next.templates.length - 1]
    ) ?? '/';

  const $currentTemplate = document.querySelector(
    `div[data-scope="${template}"]`
  );
  const $nextTemplate = $vdom.querySelector(`div[data-scope="${template}"]`);
  $currentTemplate.replaceWith($nextTemplate);
  // reinit
  init($nextTemplate);

  // Remove and unmount old scripts
  diff(scope.current.scripts, scope.next.scripts).forEach((_scope) => {
    window.__MOUNTED__?.[_scope]?.();
    const $script = document.querySelector(`script[data-scope="${_scope}"]`);
    $script?.remove();
  });

  // Add and mount new scripts
  diff(scope.next.scripts, scope.current.scripts).forEach((_scope) => {
    const script = $vdom.querySelector(
      `script[data-scope="${_scope}"]`
    )?.innerText;

    if (script) {
      const blob = new Blob([script], {
        type: 'application/javascript',
      });

      const $script = document.createElement('script');
      $script.type = 'module';
      $script.src = URL.createObjectURL(blob);

      document.body.appendChild($script);
    }
  });

  // Update URL
  window.history.pushState(null, null, next);
}

function diff(a, b) {
  if (!a) return [];
  return a.filter((x) => !b.includes(x));
}

init();
