import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import { api, CATEGORY_LABEL, MENU_ORDER, money } from '../../lib/api';
import Modal from '../../components/Modal';
import FoodImage from '../../components/FoodImage';
import Icon from '../../components/Icon';
import { DishMark, VegMark } from '../../components/Diet';

const EMPTY = { name: '', category: 'snacks', price: '', image_url: '', description: '', prep_minutes: 15, is_available: true, is_veg: true };

/** Pick the dishes inside a combo and show what customers save. */
function ComboParts({ parts, setParts, menu, price }) {
  const options = menu.filter((m) => m.category !== 'combos');
  const byId = new Map(options.map((m) => [m.id, m]));
  const regular = parts.reduce((s, p) => s + (byId.get(p.menu_item_id)?.price || 0) * p.qty, 0);
  const save = regular - Number(price || 0);
  const update = (idx, patch) => setParts(parts.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  return (
    <fieldset>
      <legend className="label">What's in the combo</legend>
      <ul className="space-y-2">
        {parts.map((p, idx) => (
          <li key={idx} className="flex gap-2">
            <select className="input" value={p.menu_item_id || ''} onChange={(e) => update(idx, { menu_item_id: Number(e.target.value) })} aria-label={`Dish ${idx + 1}`}>
              <option value="">Choose a dish…</option>
              {options.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}, {money(m.price)}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              max="20"
              className="input w-20"
              value={p.qty}
              onChange={(e) => update(idx, { qty: Math.max(1, Number(e.target.value) || 1) })}
              aria-label={`Quantity of dish ${idx + 1}`}
            />
            <button type="button" onClick={() => setParts(parts.filter((_, i) => i !== idx))} className="btn btn-quiet px-2 text-muted" aria-label={`Remove dish ${idx + 1}`}>
              <Icon name="x" size={16} />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => setParts([...parts, { menu_item_id: 0, qty: 1 }])} className="btn btn-quiet mt-1 -ml-2 text-sm">
        <Icon name="plus" size={15} /> Add a dish
      </button>
      {regular > 0 && (
        <p className="num mt-2 text-sm text-ink/70">
          Bought separately {money(regular)}.{' '}
          {save > 0 ? <span className="font-semibold text-ink">Customers save {money(save)}.</span> : 'Set the combo price lower than this so it is a deal.'}
        </p>
      )}
    </fieldset>
  );
}

function Toggle({ on, onChange, label }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${on ? 'justify-end bg-ink' : 'justify-start bg-line'}`}
    >
      <motion.span layout transition={{ type: 'spring', stiffness: 600, damping: 34 }} className="h-5 w-5 rounded-full bg-paper shadow" />
    </button>
  );
}

export default function MenuManager() {
  const [menu, setMenu] = useState(null);
  const [editing, setEditing] = useState(null);
  const [removing, setRemoving] = useState(null);

  const load = () => api('/menu?all=1').then(setMenu).catch(() => setMenu([]));
  useEffect(() => {
    load();
  }, []);

  const save = async (e) => {
    e.preventDefault();
    try {
      const body = { ...editing, price: Number(editing.price), prep_minutes: Number(editing.prep_minutes) };
      if (editing.category === 'combos') body.combo_items = (editing.combo || []).filter((p) => p.menu_item_id);
      if (editing.id) await api(`/menu/${editing.id}`, { method: 'PUT', body });
      else await api('/menu', { method: 'POST', body });
      toast.success(editing.id ? 'Item saved' : 'Item added to the menu');
      setEditing(null);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const toggle = async (item) => {
    setMenu((m) => m.map((x) => (x.id === item.id ? { ...x, is_available: !x.is_available } : x)));
    try {
      await api(`/menu/${item.id}`, { method: 'PUT', body: { is_available: !item.is_available } });
      toast(item.is_available ? `${item.name} hidden from customers` : `${item.name} is back on the menu`);
    } catch (e) {
      toast.error(e.message);
      load();
    }
  };

  const remove = async () => {
    await api(`/menu/${removing.id}`, { method: 'DELETE' });
    toast(`${removing.name} deleted`);
    setRemoving(null);
    load();
  };

  const set = (k) => (e) => setEditing({ ...editing, [k]: e.target.value });

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-4xl">Menu</h1>
        <button onClick={() => setEditing(EMPTY)} className="btn btn-dark">
          Add item
        </button>
      </div>
      <p className="mt-2 text-ink/65">Switch an item off when it runs out. Customers won't see it until you switch it back on.</p>

      {!menu && <div className="shimmer mt-6 h-64 rounded-lg" />}
      {menu &&
        MENU_ORDER.map((cat) => {
          const list = menu.filter((m) => m.category === cat);
          if (!list.length) return null;
          return (
            <section key={cat} className="mt-8">
              <h2 className="text-xl">{CATEGORY_LABEL[cat]}</h2>
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {list.map((m) => (
                  <li key={m.id} className={`flex items-center gap-4 py-3 ${m.is_available ? '' : 'opacity-50'}`}>
                    <FoodImage src={m.image_url} alt={m.name} className="h-12 w-12 shrink-0 rounded-md" />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 font-semibold">
                        <DishMark item={m} size={13} />
                        <span className="truncate">{m.name}</span>
                      </p>
                      <p className="num text-sm text-ink/60">
                        {m.combo ? m.combo.map((p) => `${p.qty}× ${p.name}`).join(', ') : `${money(m.price)}, about ${m.prep_minutes} min`}
                      </p>
                      {m.combo && (
                        <p className="num text-sm text-ink/60">
                          {money(m.price)} instead of {money(m.regular_price)}
                          {!m.components_available && <span className="font-semibold text-ink">. Hidden: a dish in it is switched off</span>}
                        </p>
                      )}
                    </div>
                    <Toggle on={m.is_available} onChange={() => toggle(m)} label={`${m.name} available`} />
                    <button onClick={() => setEditing({ ...m, image_url: m.image_url || '' })} className="btn btn-quiet text-sm">
                      Edit
                    </button>
                    <button onClick={() => setRemoving(m)} className="btn btn-quiet text-sm text-muted">
                      Delete
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={editing?.id ? `Edit ${editing.name}` : 'New menu item'}>
        {editing && (
          <form onSubmit={save} className="space-y-4">
            <label className="block">
              <span className="label">Name</span>
              <input className="input" required value={editing.name} onChange={set('name')} />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="block">
                <span className="label">Section</span>
                <select className="input" value={editing.category} onChange={set('category')}>
                  {Object.entries(CATEGORY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="label">Price (₹)</span>
                <input className="input" type="number" min="0" step="0.5" required value={editing.price} onChange={set('price')} />
              </label>
              <label className="block">
                <span className="label">Prep (min)</span>
                <input className="input" type="number" min="1" value={editing.prep_minutes} onChange={set('prep_minutes')} />
              </label>
            </div>
            {editing.category === 'drinks' ? (
              <p className="text-sm text-ink/65">🧊 Drinks show under both Veg and Non-veg, so they don't need a type.</p>
            ) : editing.category === 'combos' ? (
              <p className="flex items-center gap-2 text-sm text-ink/65">
                <VegMark veg={editing.is_veg !== false} size={13} decorative /> A combo shows as veg only when every dish in it is veg.
              </p>
            ) : (
              <fieldset>
                <legend className="label">Type</legend>
                <div className="flex gap-2">
                  {[
                    [true, 'Veg'],
                    [false, 'Non-veg'],
                  ].map(([v, label]) => (
                    <label
                      key={label}
                      className={`flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border-[1.5px] font-semibold transition-colors ${
                        (editing.is_veg !== false) === v ? 'border-ink bg-surface' : 'border-line text-ink/60 hover:border-ink/40'
                      }`}
                    >
                      <input type="radio" name="is_veg" className="sr-only" checked={(editing.is_veg !== false) === v} onChange={() => setEditing({ ...editing, is_veg: v })} />
                      <VegMark veg={v} size={14} decorative /> {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            {editing.category === 'combos' && (
              <ComboParts
                parts={editing.combo?.length ? editing.combo : [{ menu_item_id: 0, qty: 1 }, { menu_item_id: 0, qty: 1 }]}
                setParts={(combo) => setEditing({ ...editing, combo })}
                menu={menu || []}
                price={editing.price}
              />
            )}
            <label className="block">
              <span className="label">Description</span>
              <textarea className="input resize-none" rows={2} value={editing.description} onChange={set('description')} />
            </label>
            <label className="block">
              <span className="label">Photo link</span>
              <input className="input" value={editing.image_url} onChange={set('image_url')} placeholder="https://… or /images/samosa.jpg" />
            </label>
            {editing.image_url && <FoodImage src={editing.image_url} alt={editing.name || 'Preview'} className="aspect-[3/2] w-full rounded-lg" />}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setEditing(null)} className="btn btn-outline flex-1">
                Discard
              </button>
              <button className="btn btn-dark flex-1">{editing.id ? 'Save item' : 'Add item'}</button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={!!removing} onClose={() => setRemoving(null)} title={`Delete ${removing?.name ?? ''}?`}>
        <p className="text-ink/75">This removes it from the menu for good. To hide it for today only, switch it off instead.</p>
        <div className="mt-6 flex gap-3">
          <button onClick={() => setRemoving(null)} className="btn btn-outline flex-1">
            Keep it
          </button>
          <button onClick={remove} className="btn btn-dark flex-1">
            Delete item
          </button>
        </div>
      </Modal>
    </div>
  );
}
