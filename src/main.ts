#!/usr/bin/env node
import { Vaultwarden } from '@/stacks/vaultwarden';
import type { EnvConfig } from '@/types';
import { App } from 'aws-cdk-lib';
import { getEnvVarOrThrow } from './utils';

const app = new App();

const {
  AWS_ACCOUNT_ID,
  AWS_REGION,
  FILE_SYSTEM_ID,
  FILE_SYSTEM_SG,
  SERVICE_SG,
  CERTIFICATE_ARN,
}: EnvConfig = {
  AWS_ACCOUNT_ID: getEnvVarOrThrow('AWS_ACCOUNT_ID'),
  AWS_REGION: getEnvVarOrThrow('AWS_REGION'),
  FILE_SYSTEM_ID: getEnvVarOrThrow('FILE_SYSTEM_ID'),
  FILE_SYSTEM_SG: getEnvVarOrThrow('FILE_SYSTEM_SG'),
  SERVICE_SG: getEnvVarOrThrow('SERVICE_SG'),
  CERTIFICATE_ARN: getEnvVarOrThrow('CERTIFICATE_ARN'),
};

new Vaultwarden(app, 'vaultwarden', {
  clusterName: 'vaultwarden-cluster',
  fileSystemId: FILE_SYSTEM_ID,
  fileSystemSG: FILE_SYSTEM_SG,
  image: 'vaultwarden/server:latest',
  serviceName: 'vaultwarden-service',
  serviceSG: SERVICE_SG,
  taskCpu: 256,
  taskMemory: 512,
  certificateArn: CERTIFICATE_ARN,
  env: {
    account: AWS_ACCOUNT_ID,
    region: AWS_REGION,
  },
});
