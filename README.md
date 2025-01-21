# Gitness/Harness

## Structure

整体分为两个入口:terminal部分和server部分
- terminal部分充当一个client,可以和其他的server建立连接
- server则是真正后端逻辑建立的主体部分,负责处理全部的income connection

## Server

- 整个系统把所有的依赖注入在初始化阶段全部完成,通过 `initSystem` 直接注入到整个系统的。
- 所有的一切都是通过依赖注入来启动的,每个相应的 service 或者 function module 都提供了对应的接口设计,通过接口和依赖定义与注入实现一切的启动和管理操作。
- 所有一切的数据库相关操作都是基于 `sqlx.DB` 实现的统一抽象,也就造成了最终不管是什么数据库类型都可以用这一套方法进行涵盖。
  - [GitHub - jmoiron/sqlx: general purpose extensions to golang's database/sql](https://github.com/jmoiron/sqlx)
- 以 database 为例,整体的架构可以被理解为如下：
  - `database.go` 所有的数据库相关的接口定义,一切方法的原始依赖。

**启动流程——目前见过的最为优美的 code**

- 整个流程都完全基于 DI,包含使用了 `errgroup` 包进行的 goroutine 管理,结合了函数式编程。并且最终包括了整个系统的关闭等待和优雅的服务结束。
- 基于 `errorgroup` 的并发控制机制

  ```go
  g, gCtx := errgroup.WithContext(ctx)
  g.Go(func() error {
      // 执行并发任务
  })
  ```

- 整体启动服务代码:[run()](cli/operations/server/server.go#44)
- 通过DI封装好的所有系统基本启动器&逻辑入口
- 完全使用DI-依赖注入来整理全部的动态变量以及不同模块之间的上下依赖关系

```go
// System stores high level System sub-routines.
type System struct {
 bootstrap       bootstrap.Bootstrap
 server          *server.Server
 sshServer       *ssh.Server
 resolverManager *resolver.Manager
 poller          *poller.Poller
 services        services.Services
}
```

**Bootstrap module:** [bootstrap启动过程](app/bootstrap/bootstrap.go#69)

- 每一个Bootstrap中的service,都用了类似的用户管理思路,将每个service看作类似结构的用户结构进行管理,只是其相比起真实用户,具有独特的权限和标记。这样能够用同一套类似的流程代码实现系统的初始化和基础模块权限管理
- 统一的身份管理：所有系统组件都通过相同的身份机制进行管理
- 权限隔离：每个服务都有其特定的权限范围
- 简化维护：使用统一的用户管理逻辑,降低维护复杂度
- 以Bootstrap为例就可以看到整体的依赖注入设计的思路和流程：通过wire作为最外层的调用者,利用一个Provider来实现所调用函数的选择
  - wire --> provider --> injector --> interface
- 核心service管理模块初始化方式：统一的用户模型初始化
  - 将四大核心管理模块视作特殊的用户,用统一结构的用户体系进行这部分的模块管理
  - 每个service模块都是单例使用(所以会出现bootstrap代码中在创建前确保当前没有其他实例也创建了相同的管理service模块)
- 重点的四个service module启动部分:
```go
func System(config *types.Config, userCtrl *user.Controller,
	serviceCtrl *service.Controller) func(context.Context) error {
	return func(ctx context.Context) error {
		if err := SystemService(ctx, config, serviceCtrl); err != nil {
			return fmt.Errorf("failed to setup system service: %w", err)
		}

		if err := PipelineService(ctx, config, serviceCtrl); err != nil {
			return fmt.Errorf("failed to setup pipeline service: %w", err)
		}
		if err := GitspaceService(ctx, config, serviceCtrl); err != nil {
			return fmt.Errorf("failed to setup gitspace service: %w", err)
		}

		if err := AdminUser(ctx, config, userCtrl); err != nil {
			return fmt.Errorf("failed to setup admin user: %w", err)
		}

		return nil
	}
}
```

**errgroup**用于goroutine管理和使用

- <https://github.com/golang/sync/blob/master/errgroup/errgroup.go>
- metric都是通过单例模式进行管理
- 把不同模块的最外层调用,比如register作为非常标准化的抽象,上层调用的过程中所有的流程基本一致

**Server优雅关闭和善后处理**

[server_shutdown_code_parts](cli/operations/server/server.go#157)


## Core Startup

几乎所有的依赖项和执行项目都是通过先前的各种初始化,最后注入到router部分,再由router注入到httpserver最终启动整个server的运行

**并且你可以看到Harness开发团队是如何根据service来划分这些注入的模块的,这是一个非常非常重要的学习资源**
  
```go
routerRouter := router2.ProvideRouter(ctx, config, authenticator, repoController, reposettingsController, executionController, logsController, spaceController, pipelineController, secretController, triggerController, connectorController, templateController, pluginController, pullreqController, webhookController, githookController, gitInterface, serviceaccountController, controller, principalController, usergroupController, checkController, systemController, uploadController, keywordsearchController, infraproviderController, gitspaceController, migrateController, aiagentController, capabilitiesController, provider, openapiService, appRouter)
serverServer := server2.ProvideServer(config, routerRouter)
```

在之前的系统设计中,能明显的看出来你对这一部分是比较薄弱的,因此这一块他们是如何进行区分的就显得格外关键。

每个部分都是独立的service,且已经是比较高层级的封装,不会包含任何与底层相关的内容(如db,cache等等)

- config
- authenticator
- repoController
- reposettingsController
- executionController
- logsController
- spaceController
- pipelineController
- secretController
- triggerController
- connectorController
- templateController
- pluginController
- pullreqController
- webhookController
- githookController
- gitInterface
- serviceaccountController
- controller
- principalController
- usergroupController
- checkController
- systemController
- uploadController
- keywordsearchController
- infraproviderController
- gitspaceController
- migrateController
- aiagentController
- capabilitiesController
- provider
- openapiService
- appRouter

## PubSub

典型的函数式编程范式的应用：

```go
func ProvidePubSub(config Config, client redis.UniversalClient) PubSub {
	switch config.Provider {
	case ProviderRedis:
		return NewRedis(client,
			WithApp(config.App),
			WithNamespace(config.Namespace),
			WithHealthCheckInterval(config.HealthInterval),
			WithSendTimeout(config.SendTimeout),
			WithSize(config.ChannelSize),
		)
	case ProviderMemory:
		fallthrough
	default:
		return NewInMemory(
			WithApp(config.App),
			WithNamespace(config.Namespace),
			WithHealthCheckInterval(config.HealthInterval),
			WithSendTimeout(config.SendTimeout),
			WithSize(config.ChannelSize),
		)
	}
}
```

- **为什么不直接将配置作为函数参数逐个传递进入？**
  - 灵活性和可扩展性：选项模式允许你在不改变函数签名的情况下,轻松地添加或修改配置参数
  - 可读性和可维护性
  - 人工实现go的可选参数(为某些参数提供默认值)

- 特点
  - Pub和Sub都抽象了一套高层次的config和handler类别,每次遇到进行操作时,只需在调用处将操作内容的方法或config通过参数传递进去就能实现一套代码通用全部的场景
  - 通过单例管理全部的registry,包含了所有subscriber和他们对应的topic
  - 每次Publish函数都在新消息到来的时候被调用,向所有可能的subscriber进行消息传递

- Implementation
  - [InMemeory](pubsub/inmem.go)
  - [Redis](pubsub/redis.go)

**对比InMemory Channel & Redis Channel**

InMemory:
```go
func (s *inMemorySubscriber) start(ctx context.Context) {
	s.channel = make(chan []byte, s.config.channelSize)
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-s.channel:
			if !ok {
				return
			}
			if err := s.handler(msg); err != nil {
				// TODO: bump err to caller
				log.Ctx(ctx).Err(err).Msgf("in pubsub start: error while running handler for topic")
			}
		}
	}
}
```

Redis:
```go
func (s *redisSubscriber) start(ctx context.Context) {
	// Go channel which receives messages.
	ch := s.rdb.Channel(
		redis.WithChannelHealthCheckInterval(s.config.healthInterval),
		redis.WithChannelSendTimeout(s.config.sendTimeout),
		redis.WithChannelSize(s.config.channelSize),
	)
	for {
		select {
		case <-ctx.Done():
			return
		case msg, ok := <-ch:
			if !ok {
				log.Ctx(ctx).Debug().Msg("redis channel was closed")
				return
			}
			if err := s.handler([]byte(msg.Payload)); err != nil {
				log.Ctx(ctx).Err(err).Msg("received an error from handler function")
			}
		}
	}
}
```

## Cron定时任务

**Scheduler调度器**
核心代码位于：[scheduler](job/scheduler.go)

## fun parts

- Go实现的一个ssh server: [ssh_server](ssh/server.go)

## Core Modules

### openapiService

注入函数：
```go
openapiService := openapi.ProvideOpenAPIService()
```

此处本质上是返回了一个OpenAPI结构体指针,这个结构体拥有全部的与OpenAPI路径设置相关的内容。所以在使用时调用者可以直接用这个结构体指针调用其中的任何一个已经实现的函数。并且如果出现代码修改或需求增加,这部分完全不会需要大改,且增加的情况下原有代码无需任何变动。其内部本质上也是通过一种注入操作来实现的：

```go
reflector := openapi3.Reflector{}

buildSystem(&reflector)
buildAccount(&reflector)
buildUser(&reflector)
//...etc.
```
这里通过一个单独的openapi对象,在初始化时作为参数传递(注入)进对应的方法内即可实现整体解决方案的初始化流程。

### userGroup

**Accounts**
- 账户信息这一部分
- Session部分同样用到了和staticbackend中类似的session串机制,通过一套pipe操作,能够高效地处理对于一个session的权限,细节等内容的添加和修改

