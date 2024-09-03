#!/usr/bin/env node
import { Vaultwarden } from '@/stacks/vaultwarden';
import { CodeExec } from '@/stacks/code-exec';
import type { EnvConfig } from '@/types';
import { App } from 'aws-cdk-lib';
import { getEnvVarOrThrow } from '@/utils';

const app = new App();

const {
  AWS_ACCOUNT_ID,
  AWS_REGION,
  SERVICE_SG,
  FILE_SYSTEM_SG,
  CERTIFICATE_ARN,
  VW_FILE_SYSTEM_ID,
  CE_FILE_SYSTEM_ID,
}: EnvConfig = {
  AWS_ACCOUNT_ID: getEnvVarOrThrow('AWS_ACCOUNT_ID'),
  AWS_REGION: getEnvVarOrThrow('AWS_REGION'),
  SERVICE_SG: getEnvVarOrThrow('SERVICE_SG'),
  FILE_SYSTEM_SG: getEnvVarOrThrow('FILE_SYSTEM_SG'),
  CERTIFICATE_ARN: getEnvVarOrThrow('CERTIFICATE_ARN'),
  VW_FILE_SYSTEM_ID: getEnvVarOrThrow('VW_FILE_SYSTEM_ID'),
  CE_FILE_SYSTEM_ID: getEnvVarOrThrow('CE_FILE_SYSTEM_ID'),
};

new Vaultwarden(app, 'vaultwarden', {
  clusterName: 'vaultwarden-cluster',
  fileSystemId: VW_FILE_SYSTEM_ID,
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

new CodeExec(app, 'code-exec', {
  clusterName: 'codeexec-cluster',
  fileSystemId: CE_FILE_SYSTEM_ID,
  fileSystemSG: FILE_SYSTEM_SG,
  repo: 'codeexec',
  tag: 'v3',
  serviceName: 'codeexec-service',
  serviceSG: SERVICE_SG,
  taskCpu: 256,
  taskMemory: 512,
  certificateArn: CERTIFICATE_ARN,
  env: {
    account: AWS_ACCOUNT_ID,
    region: AWS_REGION,
  },
});
