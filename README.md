# Harness
Harness Open Source is an open source development platform packed with the power of code hosting, automated DevOps pipelines, hosted development environments (Gitspaces), and artifact registries.

## Reading & Reviewing

**核心：Kingpin启动+dependency injection**

```
migrate current [<envfile>]
display the current version of the database

migrate to <version> [<envfile>]
migrates the database to the provided version

server [<flags>] [<envfile>]
starts the server

user self [<flags>]
display authenticated user

user pat [<flags>] <identifier> [<lifetime>]
create personal access token

users find [<flags>] <id or email>
display user details

users ls [<flags>]
display a list of users

users create [<flags>] <email> [<admin>]
create a user

users update [<flags>] <id or email>
update a user

users delete <id or email>
delete a user

login [<server>]
login to the remote server

register [<server>]
register a user

logout
logout from the remote server

hooks pre-receive
hook that is executed before any reference of the push is updated

hooks update <ref> <old> <new>
hook that is executed before the specific reference gets updated

hooks post-receive
hook that is executed after all references of the push got updated
```

## DB

### sqlite3

每个service/requirement point都对应一套db interface，这套接口仅用于操作这个点内部的全部功能，和其他部分完全解耦

## Cache

### TTLCache design

```go
// Cache is an abstraction of a simple cache.
type Cache[K any, V any] interface {
	Stats() (int64, int64)
	Get(ctx context.Context, key K) (V, error)
}
```

```go
func New(
	pathStore store.SpacePathStore,
	spacePathTransformation store.SpacePathTransformation,
) store.SpacePathCache {
	return &pathCache{
		inner: cache.New[string, *types.SpacePath](
			&pathCacheGetter{
				spacePathStore: pathStore,
			},
			1*time.Minute),
		spacePathTransformation: spacePathTransformation,
	}
}
```

```go
type TTLCache[K comparable, V any] struct {
	mx        sync.RWMutex
	cache     map[K]cacheEntry[V]
	purgeStop chan struct{}
	getter    Getter[K, V]
	maxAge    time.Duration
	countHit  int64
	countMiss int64
}
```

缓存去重操作：惰性判断复制+缩减长度，完全原地操作
```go
// Deduplicate is a utility function that removes duplicates from slice.
func Deduplicate[V constraints.Ordered](slice []V) []V {
	if len(slice) <= 1 {
		return slice
	}

	sort.Slice(slice, func(i, j int) bool { return slice[i] < slice[j] })

	pointer := 0
	for i := 1; i < len(slice); i++ {
		if slice[pointer] != slice[i] {
			pointer++
			slice[pointer] = slice[i]
		}
	}

	return slice[:pointer+1]
}
```

## Side dishes

**优雅处理系统停止信号，终止上下文**

```go
ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
defer stop()
```

