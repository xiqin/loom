# TDD 示例和判断依据

## 好测试示例

```language
test('重试失败操作 3 次', async () => {
  let attempts = 0;
  const operation = () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };

  const result = await retryOperation(operation);

  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

特点：清晰名称、测试真实行为、一次验证一件事。

## 最小实现示例

```language
async function retryOperation<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 3; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i === 2) throw e;
    }
  }
  throw new Error('unreachable');
}
```

## 过度工程示例

```language
async function retryOperation<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    backoff?: 'linear' | 'exponential';
    onRetry?: (attempt: number) => void;
  }
): Promise<T> {
  // YAGNI
}
```

不要添加功能、重构其他代码，或"改进"超出测试范围的内容。

## Bug 修复示例

Bug：接受空邮件。

红：

```language
test('拒绝空邮件', async () => {
  const result = await submitForm({ email: '' });
  expect(result.error).toBe('Email required');
});
```

绿：

```language
function submitForm(data: FormData) {
  if (!data.email?.trim()) {
    return { error: 'Email required' };
  }
  // ...
}
```

## 为什么顺序很重要

- 测试后通过不等于验证，可能测试了错误的东西。
- 手动测试不可重演，自动化测试才能系统验证。
- 保留未验证代码是沉没成本谬误，删除并从 TDD 重新开始。

更多反模式见 `references/testing-anti-patterns.md` 和 `references/common-excuses.md`。
