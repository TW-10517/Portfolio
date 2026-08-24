// jsdom implements neither of these, and both are touched during a normal
// render of the editor (Framer Motion reads matchMedia; several panels
// observe their own size). Without stubs the component suites fail on
// environment gaps rather than on real defects.
if (typeof window !== "undefined") {
  if (!window.matchMedia) {
    window.matchMedia = (query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    });
  }
  if (!window.ResizeObserver) {
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
  if (!window.scrollTo) window.scrollTo = () => {};
}
