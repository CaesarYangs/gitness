# Gitness/Harness

## Modules

### Server

- 整个系统把所有的依赖注入在初始化阶段全部完成，通过 `initSystem` 直接注入到整个系统的。
- 所有的一切都是通过依赖注入来启动的，每个相应的 service 或者 function module 都提供了对应的接口设计，通过接口和依赖定义与注入实现一切的启动和管理操作。
- 所有一切的数据库相关操作都是基于 `sqlx.DB` 实现的统一抽象，也就造成了最终不管是什么数据库类型都可以用这一套方法进行涵盖。
    - [GitHub - jmoiron/sqlx: general purpose extensions to golang's database/sql](https://github.com/jmoiron/sqlx)
- 以 database 为例，整体的架构可以被理解为如下：
    - `database.go` 所有的数据库相关的接口定义，一切方法的原始依赖。

#### 启动流程——目前见过的最为优美的 code

- 整个流程都完全基于 DI，包含使用了 `errgroup` 包进行的 goroutine 管理，结合了函数式编程。并且最终包括了整个系统的关闭等待和优雅的服务结束。
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

- **Bootstrap module:** [bootstrap启动过程](app/bootstrap/bootstrap.go#69)
- 每一个Bootstrap中的service，都用了类似的用户管理思路，将每个service看作类似结构的用户结构进行管理，只是其相比起真实用户，具有独特的权限和标记。这样能够用同一套类似的流程代码实现系统的初始化和基础模块权限管理
- 	统一的身份管理：所有系统组件都通过相同的身份机制进行管理
- 	权限隔离：每个服务都有其特定的权限范围
- 	简化维护：使用统一的用户管理逻辑，降低维护复杂度


- **errgroup**用于goroutine管理和使用
- https://github.com/golang/sync/blob/master/errgroup/errgroup.go
- metric都是通过单例模式进行管理
- 把不同模块的最外层调用，比如register作为非常标准化的抽象，上层调用的过程中所有的流程基本一致



### fun parts
- [ssh server](ssh/server.go#129)




















#### `api` - API 相关实现，包含大量子文件 (673 个)

### `auth` - 认证相关功能

### `bootstrap` - 系统引导和初始化

### `config` - 配置管理

### `connector` - 连接器实现

### `cron` - 定时任务相关

### `events` - 事件处理系统

### `githook` - Git 钩子相关

### `gitspace` - Git 空间管理

### `jwt` - JWT (JSON Web Token) 实现

### `paths` - 路径管理

### `pipeline` - 流水线功能

### `request` - 请求处理

### `router` - 路由管理

### `server` - 服务器实现

### `services` - 各种服务实现，包含大量子文件 (188 个)

### `sse` - Server-Sent Events 实现

### `store` - 数据存储层，包含大量子文件 (434 个)

### `testing` - 测试相关

### `token` - 令牌管理

### `url` - URL 处理

## User

## Account
