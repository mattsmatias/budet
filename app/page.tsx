import { createClient } from '@/utils/supabase/server'
import { cookies } from 'next/headers'

export default async function Page() {
  const cookieStore = await cookies()
  const supabase = createClient(cookieStore)

  const { data: todos, error } = await supabase.from('todos').select()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 p-8 text-slate-100">
      <h1 className="text-4xl font-semibold tracking-tight">Budet toimii 🚀</h1>

      <section className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-6">
        <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-slate-400">
          Supabase-yhteys
        </h2>

        {error ? (
          <p className="text-sm text-amber-400">
            Virhe: {error.message}
          </p>
        ) : (
          <ul className="list-inside list-disc text-sm">
            {todos?.map((todo) => (
              <li key={todo.id}>{todo.name}</li>
            ))}
          </ul>
        )}

        {!error && todos?.length === 0 && (
          <p className="text-sm text-slate-400">
            Yhteys toimii, mutta taulussa <code>todos</code> ei ole rivejä.
          </p>
        )}
      </section>
    </main>
  )
}
