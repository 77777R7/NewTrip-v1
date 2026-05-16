export type HealthStatus = {
  status: 'ok';
  service: 'newtrip-backend';
};

export class HealthService {
  getHealth(): HealthStatus {
    return {
      status: 'ok',
      service: 'newtrip-backend',
    };
  }
}
