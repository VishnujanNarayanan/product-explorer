import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Header } from './Header';

jest.mock('next/navigation', () => ({
  usePathname: () => '/products',
}));

jest.mock('@/lib/hooks/useNavigation', () => ({
  useNavigation: () => ({
    navigation: [
      {
        id: 2,
        title: 'Fiction Books',
        slug: 'fiction-books',
        categories: [
          { id: 9, title: 'Crime & Mystery', slug: 'crime-and-mystery-books', product_count: 40 },
          { id: 11, title: 'Fantasy', slug: 'fantasy-fiction-books', product_count: 40 },
        ],
      },
    ],
  }),
}));

jest.mock('../shared/SearchBar', () => ({ SearchBar: () => <div /> }));
jest.mock('./CategoryBar', () => ({ CategoryBar: () => <div /> }));

/**
 * The menu used to close itself by watching the pathname. Every category lives at `/products` and
 * differs only by query string, which `usePathname` does not report — so arriving from the home
 * page closed it and picking a second category did not, leaving the menu open on top of the books
 * it had just fetched. Hence closing where the choice is made.
 *
 * The mocked pathname is deliberately constant: it stands for the case that used to fail.
 */
describe('Header mobile menu', () => {
  const openMenu = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.click(screen.getByRole('button', { name: 'Open menu' }));
  };

  it('closes when a category is picked, even without a path change', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await openMenu(user);
    await user.click(screen.getByRole('button', { name: /Fiction Books/ }));
    await user.click(screen.getByRole('link', { name: /Fantasy/ }));

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes on the section link too', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await openMenu(user);
    await user.click(screen.getByRole('button', { name: /Fiction Books/ }));
    await user.click(screen.getByRole('link', { name: /Browse the whole section/ }));

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('closes on a site link', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await openMenu(user);
    // The same links exist in the desktop nav, which is in the DOM at every width. The menu's
    // copy is rendered after it, and it is the one a tap on a phone reaches.
    const inMenu = screen.getAllByRole('link', { name: 'History' }).at(-1)!;
    await user.click(inMenu);

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('stays open while a section is expanded, which is not a choice yet', async () => {
    const user = userEvent.setup();
    render(<Header />);

    await openMenu(user);
    await user.click(screen.getByRole('button', { name: /Fiction Books/ }));

    expect(screen.getByRole('button', { name: 'Close menu' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Crime & Mystery/ })).toBeInTheDocument();
  });

  it('opens closed, so the page below is not covered on arrival', () => {
    render(<Header />);

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });
});
