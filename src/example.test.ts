import { Entity, MikroORM, PrimaryKey, Property, OneToOne, Rel, Cascade } from '@mikro-orm/core';
import { PGliteDriver } from 'mikro-orm-pglite';

class SubObject {
  field1!: string;
  field2!: number;
}

@Entity()
class Bar {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ type: 'jsonb' })
  jsonb_field!: SubObject[];

  @OneToOne('Foo', 'bar')
  foo!: Rel<Foo>;
}

@Entity()
class Foo {
  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string

  @OneToOne({ inversedBy: 'foo' })
  bar?: Bar;
}

let orm: MikroORM;

beforeAll(async () => {
  orm = await MikroORM.init({
    driver: PGliteDriver,
    dbName: 'postgresql',
    entities: [Foo, Bar],
    debug: ['query', 'query-params'],
    allowGlobalContext: true, // only for testing
  });
  await orm.schema.refreshDatabase();
});

afterAll(async () => {
  await orm.close(true);
});

test('refresh serialization', async () => {
  const fooRepository = orm.em.getRepository(Foo);
  const barRepository = orm.em.getRepository(Bar);

  const foo = new Foo();
  const fooEntity = fooRepository.create(foo);

  const bar = new Bar();
  bar.jsonb_field = [{ field1: 'string1', field2: 1 }, { field1: 'string2', field2: 2 }];
  const barEntity = barRepository.create(bar);
  barEntity.foo = fooEntity;

  await fooRepository.getEntityManager().persist([barEntity, fooEntity]).flush();

  expect(fooEntity.bar?.jsonb_field.length).toEqual(2);
  expect(Array.isArray(fooEntity.bar?.jsonb_field)).toBe(true);
  expect(typeof fooEntity.bar?.jsonb_field[0]).toBe('object');
  // fooEntity.bar.jsonb_field is array of objects

  await fooRepository.getEntityManager().refresh(fooEntity, { populate: ['bar'] });

  expect(fooEntity.bar?.jsonb_field.length).toEqual(2);
  expect(Array.isArray(fooEntity.bar?.jsonb_field)).toBe(true);
  expect(typeof fooEntity.bar?.jsonb_field[0]).toBe('object');
  // after refresh, fooEntity.bar.jsonb_field is string instead of array of objects
});
