import React from 'react';

// Shared form builder context for coordinating page-level state.
// Shape: {
//   setHeaderTitle?: Function,
//   headerTitle?: string,
//   setHeaderTitleChangeHandler?: Function,
//   formData?: object | null,
//   setFormData?: Function,
//   formLoading?: boolean,
//   markFormSaved?: Function,
//   hasUnsavedChanges?: boolean,
// }
const FormBuilderContext = React.createContext({
  setHeaderTitle: () => {},
  headerTitle: '',
  setHeaderTitleChangeHandler: () => {},
  formData: null,
  setFormData: () => {},
  formLoading: false,
  markFormSaved: () => {},
  hasUnsavedChanges: false,
});

export default FormBuilderContext;
