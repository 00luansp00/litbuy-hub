import { ProductMaterializationService } from './product-materialization.service';

describe('ProductMaterializationService slug foundation', () => {
  it('normalizes slugs without accents and control characters', () => {
    const service = new ProductMaterializationService(null as never);
    expect(service.publicSlugBaseForTest('  Conta Épica!!! ')).toBe('conta-epica');
  });
  it('uses a stable draft suffix for collisions', () => {
    const service = new ProductMaterializationService(null as never);
    expect(service.publicStableSuffixForTest('85347f0e-b665-4729-93be-22d446cb134a')).toBe(
      '85347f0e',
    );
  });
  it('does not create a purchasable variant for quote services', () => {
    const service = new ProductMaterializationService(null as never);
    expect(
      service.publicVariantDataForTest({
        model: 'SERVICE',
        serviceDetails: {
          title: null,
          description: null,
          draftId: 'draft',
          pricingType: 'QUOTE',
          basePrice: null,
          estimatedDelivery: null,
          buyerRequirements: null,
          notes: null,
        },
      } as never),
    ).toEqual([]);
  });
});
