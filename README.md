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

### appRouter
这部分内容都与Registry的创建，存储等操作的路由相关，属于app用户创建相关功能的路由。

core code:
- 在初始化过程中还可以直接附带上要使用的全部middleware
- 核心是使用了Chi这个Golang web路由框架


```go
func GetAppRouter(
	ociHandler oci.RegistryOCIHandler,
	appHandler harness.APIHandler,
	baseURL string,
) AppRouter {
	r := chi.NewRouter()
	r.Use(hlog.URLHandler("http.url"))
	r.Use(hlog.MethodHandler("http.method"))
	r.Use(logging.HLogRequestIDHandler())
	r.Use(logging.HLogAccessLogHandler())
	r.Use(address.Handler("", ""))

	r.Group(func(r chi.Router) {
		r.Handle(fmt.Sprintf("%s/*", baseURL), appHandler)
		r.Handle("/v2/*", ociHandler)

		r.Handle("/registry/swagger*", swagger.GetSwaggerHandler("/registry"))
	})
	return r
}
```

内部真正的router核心是APIHandler

可以看到几乎所有的函数和模块设计都用到了依赖注入的思想，每一层都不会依赖其他层的真实实现。
- 这里的apiController可以看作是一个单例的manager角色
- APIController就是实现了更上层StrictServerInterface这个app(artifact,registry)相关内容管理的接口，因此全部的实现代码都可以从controller目录内找到

```go
func NewAPIHandler(
	repoDao store.RegistryRepository,
	upstreamproxyDao store.UpstreamProxyConfigRepository,
	tagDao store.TagRepository,
	manifestDao store.ManifestRepository,
	cleanupPolicyDao store.CleanupPolicyRepository,
	imageDao store.ImageRepository,
	driver storagedriver.StorageDriver,
	baseURL string,
	spaceStore corestore.SpaceStore,
	tx dbtx.Transactor,
	authenticator authn.Authenticator,
	urlProvider urlprovider.Provider,
	authorizer authz.Authorizer,
	auditService audit.Service,
	spacePathStore corestore.SpacePathStore,
) APIHandler {
	r := chi.NewRouter()
	r.Use(audit.Middleware())
	r.Use(middlewareauthn.Attempt(authenticator))
	r.Use(middleware.CheckAuth())
	apiController := metadata.NewAPIController(
		repoDao,
		upstreamproxyDao,
		tagDao,
		manifestDao,
		cleanupPolicyDao,
		imageDao,
		driver,
		spaceStore,
		tx,
		urlProvider,
		authorizer,
		auditService,
		spacePathStore,
	)
	handler := artifact.NewStrictHandler(apiController, []artifact.StrictMiddlewareFunc{})
	muxHandler := artifact.HandlerFromMuxWithBaseURL(handler, r, baseURL)
	return encode.TerminatedPathBefore(
		terminatedPathPrefixesAPI,
		encode.TerminatedRegexPathBefore(terminatedPathRegexPrefixesAPI, muxHandler),
	)
}
```

- 从而这个部分的controller依旧是单例的manager结构，直接从NewStrictHandler传递到了最终将要实现操作管理的strictHandler这个类
- 再往下深入就可以按照每一个业务函数的代码流程进行梳理了
- 现在可以发现同时有两个结构体都实现了全部的StrictServerInterface接口
  - strictHandler
  - APIController

***他们的关系是什么？为什么要都实现一遍？***
- 继续思考代码结构就能发现，他们是将同一个interface实现了两遍，但是有不同的逻辑层次结构
  - strictHandler属于最上层，由外部直接调用的函数，包含了解包，执行，组包和上下文以及错误管理等middleware的更加系统完整的结构
  - APIController属于专注在业务逻辑，每个实现的函数都是满足业务流程的最小单元，在方便区分的同时鲁棒性更强，也更便于测试发现问题
  - 并且在APIController的实现过程中，将controller作为每个函数一个go文件的布局，文件名就是函数名，极大的简化了目录结构

**以CreateRegistry为例就能看出其中的特性**

**Upper-level**

主要是涉及到中间件的处理流程，函数中也会将真实的调用与处理过程用匿名函数包装成一个小handler，以流程化的middleware pipeline处理

```go
func (sh *strictHandler) CreateRegistry(w http.ResponseWriter, r *http.Request, params CreateRegistryParams) {
	var request CreateRegistryRequestObject

	request.Params = params

	var body CreateRegistryJSONRequestBody
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		sh.options.RequestErrorHandlerFunc(w, r, fmt.Errorf("can't decode JSON body: %w", err))
		return
	}
	request.Body = &body

	handler := func(ctx context.Context, w http.ResponseWriter, r *http.Request, request interface{}) (interface{}, error) {
		return sh.ssi.CreateRegistry(ctx, request.(CreateRegistryRequestObject))
	}
	for _, middleware := range sh.middlewares {
		handler = middleware(handler, "CreateRegistry")
	}

	response, err := handler(r.Context(), w, r, request)

	if err != nil {
		sh.options.ResponseErrorHandlerFunc(w, r, err)
	} else if validResponse, ok := response.(CreateRegistryResponseObject); ok {
		if err := validResponse.VisitCreateRegistryResponse(w); err != nil {
			sh.options.ResponseErrorHandlerFunc(w, r, err)
		}
	} else if response != nil {
		sh.options.ResponseErrorHandlerFunc(w, r, fmt.Errorf("unexpected response type: %T", response))
	}
}
```

**Lower-level**

主要是真实的业务流程代码，解开请求，与数据库相关，并会判断是virtual的还是会真实落盘，有相应的处理流程

```go
func (c *APIController) CreateRegistry(
	ctx context.Context,
	r artifact.CreateRegistryRequestObject,
) (artifact.CreateRegistryResponseObject, error) {
	registryRequest := artifact.RegistryRequest(*r.Body)
	parentRef := artifact.SpaceRefPathParam(*registryRequest.ParentRef)

	regInfo, err := c.GetRegistryRequestBaseInfo(ctx, string(parentRef), "")
	if err != nil {
		return artifact.CreateRegistry400JSONResponse{
			BadRequestJSONResponse: artifact.BadRequestJSONResponse(
				*GetErrorResponse(http.StatusBadRequest, err.Error()),
			),
		}, err
	}

	space, err := c.SpaceStore.FindByRef(ctx, regInfo.ParentRef)
	if err != nil {
		return artifact.CreateRegistry400JSONResponse{
			BadRequestJSONResponse: artifact.BadRequestJSONResponse(
				*GetErrorResponse(http.StatusBadRequest, err.Error()),
			),
		}, err
	}

	session, _ := request.AuthSessionFrom(ctx)
	if err = apiauth.CheckSpaceScope(
		ctx,
		c.Authorizer,
		session,
		space,
		gitnessenum.ResourceTypeRegistry,
		gitnessenum.PermissionRegistryEdit,
	); err != nil {
		return artifact.CreateRegistry403JSONResponse{
			UnauthorizedJSONResponse: artifact.UnauthorizedJSONResponse(
				*GetErrorResponse(http.StatusForbidden, err.Error()),
			),
		}, err
	}

	if registryRequest.Config.Type == artifact.RegistryTypeVIRTUAL {
		return c.createVirtualRegistry(ctx, registryRequest, regInfo, session, parentRef)
	}
	registry, upstreamproxy, err := c.CreateUpstreamProxyEntity(
		ctx,
		registryRequest,
		regInfo.parentID, regInfo.rootIdentifierID,
	)
	var registryID int64
	if err != nil {
		return throwCreateRegistry400Error(err), err
	}

	err = c.tx.WithTx(
		ctx, func(ctx context.Context) error {
			registryID, err = c.createRegistryWithAudit(ctx, registry, session.Principal, string(parentRef))

			if err != nil {
				return fmt.Errorf("failed to create registry: %w", err)
			}

			upstreamproxy.RegistryID = registryID

			_, err = c.createUpstreamProxyWithAudit(
				ctx, upstreamproxy, session.Principal, string(parentRef), registry.Name,
			)

			if err != nil {
				return fmt.Errorf("failed to create upstream proxy: %w", err)
			}
			return nil
		},
	)

	if err != nil {
		return throwCreateRegistry400Error(err), err
	}
	upstreamproxyEntity, err := c.UpstreamProxyStore.Get(ctx, registryID)
	if err != nil {
		return throwCreateRegistry400Error(err), err
	}

	return artifact.CreateRegistry201JSONResponse{
		RegistryResponseJSONResponse: *CreateUpstreamProxyResponseJSONResponse(upstreamproxyEntity),
	}, nil
}
```