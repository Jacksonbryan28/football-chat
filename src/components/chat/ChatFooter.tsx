export function ChatFooter() {
  return (
    <footer className="pb-5 text-center text-xs text-muted-foreground">
      Data from{' '}
      <a className="underline" href="https://github.com/nflverse/nflverse-data">
        nflverse
      </a>{' '}
      ·{' '}
      <a className="underline" href="/data">
        Data check
      </a>
    </footer>
  );
}
