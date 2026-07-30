import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SideRail } from './SideRail';

/**
 * The rail sits beside the content on a wide screen and above it on a narrow one, where thirty
 * categories stacked ahead of the grid meant scrolling past the entire contents page to reach a
 * single book. So on narrow screens it collapses, and picking a category closes it again — the
 * point of picking one is to get to the books.
 *
 * Which of the two layouts is showing is a media query, which jsdom does not evaluate; what these
 * cover is the disclosure behaviour underneath it.
 */
describe('SideRail', () => {
  const items = [
    { id: 1, title: 'Crime & Mystery', count: 40 },
    { id: 2, title: 'Fantasy', count: 40, isActive: true },
    { id: 3, title: 'Science Fiction' },
  ];

  /** The toggle is the only element carrying aria-expanded; category titles appear on both. */
  const toggle = () => screen.getByRole('button', { expanded: false });
  const openToggle = () => screen.getByRole('button', { expanded: true });

  it('starts collapsed, so the content below it starts at the top of the page', () => {
    render(<SideRail label="Categories" items={items} />);

    expect(toggle()).toBeInTheDocument();
  });

  it('names the category you are in while collapsed, which the list cannot', () => {
    render(<SideRail label="Categories" items={items} />);

    expect(toggle()).toHaveTextContent('Fantasy');
  });

  it('falls back to the heading when nothing is selected yet', () => {
    render(<SideRail label="Categories" context="Fiction Books" items={[items[0]]} />);

    expect(toggle()).toHaveTextContent('Fiction Books');
  });

  it('opens on tap', async () => {
    const user = userEvent.setup();
    render(<SideRail label="Categories" items={items} />);

    await user.click(toggle());

    expect(openToggle()).toBeInTheDocument();
  });

  it('closes again once a category is picked, and reports the pick', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    render(<SideRail label="Categories" items={items} onSelect={onSelect} />);

    await user.click(toggle());
    await user.click(screen.getByRole('button', { name: /Science Fiction/ }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ title: 'Science Fiction' }));
    expect(toggle()).toBeInTheDocument();
  });

  it('closes when a category is a link rather than a selection', async () => {
    const user = userEvent.setup();
    const linked = [{ id: 9, title: 'Rare Books', href: '/products?category=rare-books' }];
    render(<SideRail label="Sections" items={linked} />);

    await user.click(toggle());
    await user.click(screen.getByRole('link', { name: /Rare Books/ }));

    expect(toggle()).toBeInTheDocument();
  });

  /**
   * Closing alone was not enough. The list scrolls its active row into view when it opens, and on
   * a phone the rail is a full-width block near the top — so opening dragged the window up to the
   * rail, and picking a category left you looking at that instead of the books. It read as the
   * panel having stayed open.
   */
  describe('after picking a category', () => {
    it('puts the page back at the top, where the books are', async () => {
      const user = userEvent.setup();
      const scrollTo = jest.fn();
      window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
      render(<SideRail label="Categories" items={items} onSelect={jest.fn()} />);

      await user.click(toggle());
      await user.click(screen.getByRole('button', { name: /Science Fiction/ }));

      expect(scrollTo).toHaveBeenCalledWith(expect.objectContaining({ top: 0 }));
    });

    it('leaves the page alone on a wide screen, where the list never opened', async () => {
      const user = userEvent.setup();
      const scrollTo = jest.fn();
      window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
      render(<SideRail label="Categories" items={items} onSelect={jest.fn()} />);

      // The list is always visible on lg and up, so `isOpen` stays false and a click there
      // must not throw the reader back to the top of a page they were reading.
      await user.click(screen.getByRole('button', { name: /Science Fiction/ }));

      expect(scrollTo).not.toHaveBeenCalled();
    });
  });

  it('points the toggle at the list it controls', () => {
    render(<SideRail label="Categories" items={items} />);

    const controls = toggle().getAttribute('aria-controls');

    expect(controls).toBeTruthy();
    expect(document.getElementById(controls!)).toBe(
      screen.getByRole('navigation', { name: 'Categories' }),
    );
  });

  it('still renders every category, so the wide layout is unaffected', () => {
    render(<SideRail label="Categories" items={items} />);

    expect(screen.getByRole('button', { name: /Crime & Mystery/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Science Fiction/ })).toBeInTheDocument();
  });
});
