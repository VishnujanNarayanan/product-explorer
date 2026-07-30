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
