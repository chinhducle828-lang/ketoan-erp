/**
 * Component tests for ProductCard (storefront).
 * Uses @testing-library/react + Vitest (jsdom environment).
 */

import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ProductCard from './ProductCard.jsx';

const baseProduct = {
  id: 1,
  name: 'Vật tư A',
  code: 'VT001',
  price_sell: '100.000',
  unit: 'Cái',
  opening_quantity: 5,
  image_urls: ['https://example.com/img.png'],
};

describe('ProductCard', () => {
  test('renders product name, code and price', () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.getByText('Vật tư A')).toBeTruthy();
    expect(screen.getByText('VT001')).toBeTruthy();
    // price with 8% VAT => 108000 formatted
    expect(screen.getByText('108.000đ')).toBeTruthy();
  });

  test('renders product image when image_urls present', () => {
    render(<ProductCard product={baseProduct} />);
    const img = screen.getByAltText('Vật tư A');
    expect(img).toBeTruthy();
    expect(img.getAttribute('src')).toBe('https://example.com/img.png');
  });

  test('renders placeholder when no image', () => {
    const { container } = render(
      <ProductCard product={{ ...baseProduct, image_urls: [], image_url: null }} />
    );
    // Package icon placeholder should be present (svg)
    expect(container.querySelector('svg')).toBeTruthy();
  });

  test('calls onAction when action button clicked', () => {
    const onAction = vi.fn();
    render(<ProductCard product={baseProduct} onAction={onAction} actionLabel="Mua" />);
    fireEvent.click(screen.getByTitle('Mua'));
    expect(onAction).toHaveBeenCalledWith(baseProduct);
  });

  test('calls onViewDetails when title clicked', () => {
    const onViewDetails = vi.fn();
    render(<ProductCard product={baseProduct} onViewDetails={onViewDetails} />);
    fireEvent.click(screen.getByText('Vật tư A'));
    expect(onViewDetails).toHaveBeenCalledWith(baseProduct);
  });

  test('calls onToggleWishlist when wishlist button clicked', () => {
    const onToggleWishlist = vi.fn();
    render(
      <ProductCard
        product={baseProduct}
        onToggleWishlist={onToggleWishlist}
        isInWishlist={false}
      />
    );
    fireEvent.click(screen.getByTitle('Thêm vào yêu thích'));
    expect(onToggleWishlist).toHaveBeenCalledWith(1);
  });

  test('does not render action button when onAction is undefined', () => {
    render(<ProductCard product={baseProduct} />);
    expect(screen.queryByTitle('Thêm')).toBeNull();
  });
});