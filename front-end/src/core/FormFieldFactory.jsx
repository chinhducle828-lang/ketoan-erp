/**
 * FormFieldFactory.jsx - Map field.type → Component
 * Component Registry cho DynamicForm
 */

import {
  TextInput,
  NumberInput,
  CurrencyInput,
  SelectInput,
  DateInput,
  PercentInput,
  RadioGroup,
  SubGrid
} from './FormFieldComponents.jsx';

const COMPONENT_MAP = {
  'TEXT': TextInput,
  'NUMBER': NumberInput,
  'CURRENCY': CurrencyInput,
  'MONEY': CurrencyInput,
  'SELECT': SelectInput,
  'DATE': DateInput,
  'PERCENT': PercentInput,
  'RADIO': RadioGroup,
  'SUB_GRID': SubGrid,
  'SELECT_COMPANY': SelectInput,
  'SELECT_CURRENCY': SelectInput,
  'SELECT_ITEM': SelectInput
};

export default function FormFieldFactory({ field, register, errors, control, watchedValues }) {
  const Component = COMPONENT_MAP[field.type];

  if (!Component) {
    console.warn(`Unknown field type: ${field.type}, fallback to TextInput`);
    return <TextInput field={field} register={register} error={errors?.[field.id]} />;
  }

  return (
    <Component
      field={field}
      register={register}
      error={errors?.[field.id]}
      control={control}
      watchedValues={watchedValues}
    />
  );
}