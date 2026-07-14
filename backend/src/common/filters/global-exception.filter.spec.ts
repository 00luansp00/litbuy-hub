import { BadRequestException } from '@nestjs/common';
import { GlobalExceptionFilter } from './global-exception.filter';

function createHost() {
  const json = jest.fn();
  const status = jest.fn().mockReturnValue({ json });
  const request = {
    requestId: 'req-test',
    originalUrl: '/api/v1/example',
    url: '/api/v1/example',
  };

  return {
    host: {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ status }),
      }),
    } as never,
    status,
    json,
  };
}

describe('GlobalExceptionFilter', () => {
  it('formats validation errors consistently', () => {
    const filter = new GlobalExceptionFilter();
    const { host, status, json } = createHost();

    filter.catch(new BadRequestException(['field must be valid']), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: 'Bad Request Exception',
        details: ['field must be valid'],
        requestId: 'req-test',
        path: '/api/v1/example',
      }),
    );
  });
});
