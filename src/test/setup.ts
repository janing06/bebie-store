import 'fake-indexeddb/auto'
import '@testing-library/jest-dom/vitest'

// jsdom lacks pointer capture, which the swipeable cart bar uses.
if (typeof HTMLElement !== 'undefined') HTMLElement.prototype.setPointerCapture = () => {}
