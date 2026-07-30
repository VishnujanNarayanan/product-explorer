import '@testing-library/jest-dom';

// jsdom implements no layout, so it has no scrollIntoView — and a component calling one on mount
// throws rather than being ignored. Components legitimately use it to bring an active row into
// view; a no-op keeps that a rendering concern rather than a reason tests cannot run.
Element.prototype.scrollIntoView = jest.fn();
