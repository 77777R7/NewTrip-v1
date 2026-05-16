import { HealthService } from './health.service';

describe('HealthService', () => {
  it('reports the backend health status', () => {
    const service = new HealthService();

    expect(service.getHealth()).toEqual({
      status: 'ok',
      service: 'newtrip-backend',
    });
  });
});
