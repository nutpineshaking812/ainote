import { componentCategories } from './components.js';

// The registry itself
// Create an empty map
export const componentRegistry = new Map();

// Register each component using the .set(key, value) method
Object.values(componentCategories).forEach((category) => {
  category.components.forEach((component) => {
    componentRegistry.set(component.type, component);
  });
});
