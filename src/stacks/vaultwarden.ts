import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as ecs from 'aws-cdk-lib/aws-ecs';
import * as ecsPatterns from 'aws-cdk-lib/aws-ecs-patterns';
import * as efs from 'aws-cdk-lib/aws-efs';
import * as elbv2 from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import { ApplicationProtocol, SslPolicy } from 'aws-cdk-lib/aws-elasticloadbalancingv2';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

type Props = StackProps & {
  taskCpu: number;
  taskMemory: number;
  clusterName: string;
  serviceName: string;
  serviceSG: string;
  image: string;
  fileSystemId: string;
  fileSystemSG: string;
  certificateArn: string;
};

export class Vaultwarden extends Stack {
  constructor(scope: Construct, id: string, props: Props) {
    super(scope, id, props);

    const vpc = ec2.Vpc.fromLookup(this, 'VPC', { isDefault: true });
    const certificate = acm.Certificate.fromCertificateArn(
      this,
      'Certificate',
      props.certificateArn,
    );
    const cluster = new ecs.Cluster(this, 'Cluster', {
      clusterName: props.clusterName,
      vpc,
    });
    const fileSystem = efs.FileSystem.fromFileSystemAttributes(this, 'EFS', {
      fileSystemId: props.fileSystemId,
      securityGroup: ec2.SecurityGroup.fromSecurityGroupId(
        this,
        'EFSSecurityGroup',
        props.fileSystemSG,
      ),
    });
    fileSystem.addToResourcePolicy(
      new iam.PolicyStatement({
        actions: ['elasticfilesystem:ClientMount'],
        principals: [new iam.AnyPrincipal()],
        conditions: {
          Bool: { 'elasticfilesystem:AccessedViaMountTarget': 'true' },
        },
      }),
    );

    const taskDefinition = new ecs.FargateTaskDefinition(this, 'TaskDefinition', {
      memoryLimitMiB: props.taskMemory,
      cpu: props.taskCpu,
      executionRole: new iam.Role(this, 'TaskExecutionRole', {
        assumedBy: new iam.ServicePrincipal('ecs-tasks.amazonaws.com'),
      }),
      volumes: [
        {
          name: 'efs',
          efsVolumeConfiguration: {
            fileSystemId: fileSystem.fileSystemId,
          },
        },
      ],
    });

    const logging = new ecs.AwsLogDriver({
      streamPrefix: 'vaultwarden',
    });

    const containerDefinition = new ecs.ContainerDefinition(this, 'ContainerDefinition', {
      image: ecs.ContainerImage.fromRegistry(props.image),
      taskDefinition,
      environment: {
        ADMIN_TOKEN: process.env.ADMIN_TOKEN ?? '',
      },
      logging,
      portMappings: [{ containerPort: 80 }],
    });
    containerDefinition.addMountPoints({
      containerPath: '/data',
      sourceVolume: 'efs',
      readOnly: false,
    });

    const fargateService = new ecsPatterns.ApplicationLoadBalancedFargateService(this, 'Service', {
      cluster,
      taskDefinition,
      serviceName: props.serviceName,
      desiredCount: 1,
      assignPublicIp: true,
      publicLoadBalancer: true,
      listenerPort: 80,
      securityGroups: [
        ec2.SecurityGroup.fromSecurityGroupId(this, 'ECSSecurityGroup', props.serviceSG),
      ],
    });
    fargateService.listener.addAction('RedirectToHttps', {
      action: elbv2.ListenerAction.redirect({
        protocol: ApplicationProtocol.HTTPS,
        port: '443',
        permanent: true,
      }),
    });
    fargateService.loadBalancer.addListener('https', {
      port: 443,
      protocol: ApplicationProtocol.HTTPS,
      sslPolicy: SslPolicy.RECOMMENDED_TLS,
      defaultTargetGroups: [fargateService.targetGroup],
      certificates: [certificate],
    });

    fileSystem.grantRootAccess(fargateService.taskDefinition.taskRole.grantPrincipal);
    fileSystem.connections.allowDefaultPortFrom(fargateService.service.connections);
    fileSystem.connections.allowDefaultPortTo(fargateService.service.connections);

    const scaling = fargateService.service.autoScaleTaskCount({ maxCapacity: 2 });
    scaling.scaleOnCpuUtilization('CpuScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });
    scaling.scaleOnMemoryUtilization('MemoryScaling', {
      targetUtilizationPercent: 70,
      scaleInCooldown: Duration.seconds(60),
      scaleOutCooldown: Duration.seconds(60),
    });

    new CfnOutput(this, 'LoadBalancerDNS', {
      value: fargateService.loadBalancer.loadBalancerDnsName,
    });
  }
}
