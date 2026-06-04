"use client";

import { useState, useTransition } from "react";

import {
  addLocalOpponent,
  deleteLocalOpponent,
} from "@/app/opponents/actions";

export type LocalOpponent = {
  id: string;
  name: string;
};

export function LocalOpponentsManager({
  opponents,
}: {
  opponents: LocalOpponent[];
}) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleAdd() {
    setError(null);
    startTransition(async () => {
      const result = await addLocalOpponent(name);
      if (result.error) {
        setError(result.error);
        return;
      }
      setName("");
    });
  }

  function handleDelete(id: string) {
    setError(null);
    startTransition(async () => {
      const result = await deleteLocalOpponent(id);
      if (result.error) {
        setError(result.error);
      }
    });
  }

  return (
    <section className="dart-panel rounded-xl p-4">
      <h2 className="text-sm font-medium text-dart-cream">Lokale modstandere</h2>
      <p className="mt-1 text-xs text-dart-muted">
        Gem navne du spiller mod — vælg dem når du starter et spil.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Fx Lars"
          maxLength={40}
          disabled={pending}
          className="min-h-11 flex-1 rounded-lg border-2 border-dart-wire bg-dart-black px-3 text-base text-dart-cream placeholder:text-dart-muted"
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <button
          type="button"
          disabled={pending || !name.trim()}
          onClick={handleAdd}
          className="shrink-0 rounded-lg border-2 border-dart-cream px-4 text-sm font-medium text-dart-cream disabled:opacity-50"
        >
          Tilføj
        </button>
      </div>

      {error && (
        <p className="mt-2 text-sm text-dart-red">{error}</p>
      )}

      {opponents.length > 0 ? (
        <ul className="mt-4 flex flex-col gap-2">
          {opponents.map((opponent) => (
            <li
              key={opponent.id}
              className="flex items-center justify-between rounded-lg border border-dart-wire/50 px-3 py-2"
            >
              <span className="font-medium text-dart-cream">{opponent.name}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() => handleDelete(opponent.id)}
                className="text-sm text-dart-muted underline disabled:opacity-50"
              >
                Slet
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-dart-muted">Ingen modstandere endnu.</p>
      )}
    </section>
  );
}
