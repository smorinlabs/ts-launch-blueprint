---
trigger: glob
globs: Justfile
---

Ensure that there's proper spacing between recipes, a new line.

Every recipe is part of a group that already exists in the Just file, and that there is documentation which should be a comment right before the recipe.

```Justfile
# Run type checker (tsc --noEmit)
[group('dev')]
@typecheck:
    echo "Running type checker..."
    echo "  tsc --noEmit"
    npm run typecheck

alias tc := typecheck

# Format code (oxfmt writes fixes and sorts imports)
[group('dev'), group('pre-commit')]
@format:
    echo "Running formatter..."
    echo "  oxfmt --write (+ sortImports)"
    npx oxfmt

alias f := format
```
