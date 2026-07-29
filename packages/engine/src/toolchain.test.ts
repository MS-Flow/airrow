// Tests for reading a stack out of the sentence a founder wrote about it.
//
// The reported defect: a founder answered "stack for mobileapp ios" and their START_HERE.md named
// four `[NEEDS CLARIFICATION]` markers where every command should have been. Nothing was broken —
// there was simply no rung between "the model wrote it" and "we admit we do not know".
import { describe, it, expect } from "vitest";
import { inferStack } from "./toolchain.ts";
import { TOOLCHAIN_SLOTS } from "../../schemas/src/authoring.ts";

describe("the sentence a founder wrote decides the toolchain", () => {
  it("reads a mobile app with no framework named as the stack mobile apps are built in", () => {
    const stack = inferStack("stack for mobileapp ios");
    expect(stack?.id).toBe("mobile");
    expect(stack?.commands.CMD_DEV).toBe("npx expo start");
    expect(stack?.commands.CMD_TEST).toBe("npm test");
  });

  it("lets a named framework win over the words around it", () => {
    expect(inferStack("native ios app in SwiftUI")?.id).toBe("swift");
    expect(inferStack("android app with Kotlin and Jetpack Compose")?.id).toBe("android");
    expect(inferStack("cross-platform mobile in Flutter")?.id).toBe("flutter");
    expect(inferStack("React Native for iOS and Android")?.id).toBe("expo");
  });

  it("covers the ecosystems a founder is most likely to name", () => {
    const cases: [string, string, string][] = [
      ["Django 5 with Python 3.12 and uv", "django", "python manage.py runserver"],
      ["FastAPI with SQLModel", "fastapi", "uvicorn app.main:app --reload"],
      ["Ruby on Rails 7 with Postgres", "rails", "bin/rails server"],
      ["Laravel 11 with PHP 8.3", "laravel", "php artisan serve"],
      ["ASP.NET Core with EF Core (C#)", "dotnet", "dotnet watch run"],
      ["Spring Boot with Java 21 and Maven", "spring", "./mvnw spring-boot:run"],
      ["Rust with Axum", "rust", "cargo run"],
      ["Go 1.22 with chi", "go", "go run ./..."],
      ["SvelteKit with TypeScript", "node", "npm run dev"]
    ];
    for (const [description, id, dev] of cases) {
      const stack = inferStack(description);
      expect(stack?.id, description).toBe(id);
      expect(stack?.commands.CMD_DEV, description).toBe(dev);
    }
  });

  it("uses the package manager the founder named, since the wrong one fails CI on the lockfile", () => {
    expect(inferStack("SvelteKit with pnpm")?.commands.CMD_DEV).toBe("pnpm dev");
    expect(inferStack("Nuxt with yarn")?.commands.CMD_DEV).toBe("yarn dev");
    expect(inferStack("Hono on Bun")?.commands.CMD_DEV).toBe("bun run dev");
    expect(inferStack("Express with npm")?.install).toBe("npm ci");
    expect(inferStack("Astro with pnpm")?.install).toBe("pnpm install --frozen-lockfile");
  });

  it("fills every command it claims a stack for — a partial toolchain is the same broken file", () => {
    for (const description of ["stack for mobileapp ios", "Django 5", "Go with chi", "Rust", "Rails 7"]) {
      const stack = inferStack(description);
      for (const slot of TOOLCHAIN_SLOTS) {
        expect(stack?.commands[slot], `${description} ${slot}`).toBeTruthy();
      }
    }
  });

  // Two identical commands in CLAUDE.md, and a CI job running the same check twice, reads as
  // carelessness — which is what a reader concludes about everything else in the file too.
  it("never gives an ecosystem the same command for its type check and its linter", () => {
    for (const description of ["Django", "Rails", "Go", "Rust", "Laravel", "SvelteKit", "Flutter"]) {
      const stack = inferStack(description);
      expect(stack?.commands.CMD_TYPECHECK, description).not.toBe(stack?.commands.CMD_LINT);
    }
  });

  it("admits it does not recognise a stack rather than inventing one", () => {
    expect(inferStack("")).toBeNull();
    expect(inferStack("   ")).toBeNull();
    expect(inferStack("something entirely of my own devising")).toBeNull();
  });
});
