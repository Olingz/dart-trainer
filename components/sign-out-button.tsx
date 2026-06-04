export function SignOutButton() {
  return (
    <form action="/auth/signout" method="post">
      <button
        type="submit"
        className="min-h-12 w-full rounded-xl border-2 border-dart-wire bg-transparent px-4 text-base font-medium text-dart-muted transition-colors active:border-dart-cream active:text-dart-cream"
      >
        Log ud
      </button>
    </form>
  );
}
