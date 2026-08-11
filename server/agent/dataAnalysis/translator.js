/**
 * @fileoverview Defines the Translator class for mapping business logic to database schemas.
 * It fetches and caches schemas, and provides methods to get physical field names and types.
 */

export class Translator {
  /**
   * @param {string} mainFormName - The name of the main form for the query.
   */
  constructor(mainFormName) {
    if (!mainFormName) {
      throw new Error('Translator must be initialized with a mainFormName.');
    }
    this.mainFormName = mainFormName;
    this.schemasMap = new Map(); // Map<formName, schema>
    this.physicalFields = new Map(); // Map<formName, Map<label, id>>
    this.physicalFieldTypes = new Map(); // Map<formName, Map<label, type>>
    this.optionsMaps = new Map(); // Map<formName, Map<label, options[]>>
  }

  /**
   * Asynchronously initializes the translator by fetching all required schemas.
   * @param {object} task - The task object from the LLM.
   * @param {function} getSchemaByName - The function to fetch a schema by its name.
   */
  async init(task, getSchemaByName) {
    console.log('[Translator] Async initialization started...');

    const schemaNamesToFetch = new Set([task.data_source]);
    if (task.joins) {
      for (const join of task.joins) {
        schemaNamesToFetch.add(join.source_form);
        schemaNamesToFetch.add(join.link_form);
      }
    }

    const fetchPromises = [];
    for (const formName of schemaNamesToFetch) {
      if (!this.schemasMap.has(formName)) {
        fetchPromises.push(
          getSchemaByName(formName).then(schema => {
            if (!schema) {
              throw new Error(`[Translator] init failed: Schema not found for "${formName}"`);
            }
            this.schemasMap.set(formName, schema);
          })
        );
      }
    }
    await Promise.all(fetchPromises);
    console.log('[Translator] All schemas fetched:', ...this.schemasMap.keys());

    for (const [formName, schema] of this.schemasMap.entries()) {
      const fieldMap = new Map();
      const typeMap = new Map();
      const optionsMap = new Map();

      if (schema.fields) {
        for (const field of schema.fields) {
          const label = field.properties.label;
          fieldMap.set(label, field.id);

          let chartType = 'category';
          if (['DatePicker', 'DateTime'].includes(field.properties.type)) {
            chartType = 'time';
          } else if (['NumberInput', 'Currency'].includes(field.properties.type)) {
            chartType = 'value';
          }
          typeMap.set(label, chartType);

          if (field.properties.options && Array.isArray(field.properties.options)) {
            optionsMap.set(label, field.properties.options);
          }
        }
      }
      this.physicalFields.set(formName, fieldMap);
      this.physicalFieldTypes.set(formName, typeMap);
      this.optionsMaps.set(formName, optionsMap);
    }
    console.log('[Translator] Lookup tables populated.');
  }

  /**
   * Gets the machine-readable key (field ID) for a given field label and form name.
   * @param {string} fieldLabel - The human-readable field label.
   * @param {string} formName - The name of the form.
   * @returns {string|undefined} The field ID or undefined if not found.
   */
  getMachineKey(fieldLabel, formName) {
    return this.physicalFields.get(formName)?.get(fieldLabel);
  }

  /**
   * Gets the ECharts-compatible type for a given field.
   * @param {string} fieldLabel - The human-readable field label.
   * @param {string} formName - The name of the form.
   * @returns {string} The chart type ('category', 'time', 'value').
   */
  getChartType(fieldLabel, formName) {
    return this.physicalFieldTypes.get(formName)?.get(fieldLabel) || 'category';
  }

  /**
   * Gets the full BSON path for a field to be used in aggregation stages like $group or $project.
   * @param {string} fieldLabel - The human-readable field label.
   * @param {string} formName - The name of the form.
   * @returns {string} The BSON path (e.g., '$data.field_id').
   */
  getFieldPath(fieldLabel, formName) {
    const key = this.getMachineKey(fieldLabel, formName);
    if (!key) {
      return fieldLabel; // Fallback if not translatable
    }
    if (formName === this.mainFormName) {
      return `$data.${key}`;
    }
    return `$joined_${formName}.data.${key}`;
  }

  /**
   * Gets the path for a field to be used in a $match stage (without the leading '$').
   * @param {string} fieldLabel - The human-readable field label.
   * @param {string} formName - The name of the form.
   * @returns {string} The match path (e.g., 'data.field_id').
   */
  getMatchPath(fieldLabel, formName) {
    const path = this.getFieldPath(fieldLabel, formName);
    return path.startsWith('$') ? path.substring(1) : path;
  }

  /**
   * Generates an $addFields stage to map dimension values to their labels if options are available.
   * This is useful for making chart legends and axes more human-readable.
   * @param {object} dimension - The dimension object ({ field, source }).
   * @param {string} idPath - The MongoDB path to the _id field that contains the dimension value (e.g., '$_id' for 1D, '$_id.dim2Field' for 2D).
   * @returns {object|null} An $addFields stage object or null if no options are found for the dimension.
   */
  getLabelMappingStage(dimension, idPath) {
    const dimOptions = this.optionsMaps.get(dimension.source)?.get(dimension.field);
    if (dimOptions && Array.isArray(dimOptions) && dimOptions.length > 0) {
      const branches = dimOptions.map(opt => ({
        case: { $eq: [idPath, opt.value] },
        then: opt.label,
      }));
      return {
        $addFields: {
          [idPath.replace('$', '')]: { // Replace '$' to get the field name for $addFields
            $switch: { branches: branches, default: idPath },
          },
        },
      };
    }
    return null;
  }

  /**
   * Gets the friendly display title for a field from its schema definition.
   * @param {string} fieldLabel - The human-readable field label (from task.dimensions or task.metrics).
   * @param {string} formName - The name of the form the field belongs to.
   * @returns {string} The friendly title, or the original fieldLabel if not found.
   */
  getFriendlyFieldTitle(fieldLabel, formName) {
    const schema = this.schemasMap.get(formName);
    if (schema && schema.fields) {
      const field = schema.fields.find(f => f.properties.label === fieldLabel);
      if (field && field.properties.label) {
        return field.properties.label;
      }
    }
    return fieldLabel; // Fallback to original label if not found
  }
}
