/* eslint-disable lines-between-class-members */
import { TemplateKind } from '@console/internal/module/k8s';
import { TemplateModel } from '@console/internal/models';
import { K8sResourceWrapper } from '../common/k8s-resource-wrapper';
import { VMWrapper } from './vm-wrapper';
import { selectVM } from '../../../selectors/vm-template/basic';
import { findKeySuffixValue } from '../../../selectors/utils';
import {
  TEMPLATE_FLAVOR_LABEL,
  TEMPLATE_OS_LABEL,
  TEMPLATE_WORKLOAD_LABEL,
} from '../../../constants/vm';
import { K8sInitAddon } from '../common/util/k8s-mixin';

export class VMTemplateWrapper extends K8sResourceWrapper<TemplateKind, VMTemplateWrapper> {
  constructor(template?: TemplateKind | VMTemplateWrapper | any, copy = false) {
    super(TemplateModel, template, copy);
  }

  init(data: K8sInitAddon & { parameters?: any[]; objects?: any[] } = {}) {
    super.init(data);
    const { parameters, objects } = data || {};
    if (parameters !== undefined) {
      this.data.parameters = parameters;
    }
    if (objects !== undefined) {
      this.data.objects = objects;
    }

    return this;
  }

  getOperatingSystem = () => findKeySuffixValue(this.getLabels(), TEMPLATE_OS_LABEL);
  getWorkloadProfile = () => findKeySuffixValue(this.getLabels(), TEMPLATE_WORKLOAD_LABEL);
  getFlavor = () => findKeySuffixValue(this.getLabels(), TEMPLATE_FLAVOR_LABEL);

  getParameters = (defaultValue = []) => (this.data && this.data.parameters) || defaultValue;

  getVM = (copy = false) => new VMWrapper(selectVM(this.data), copy);

  setParameter = (name, value) => {
    const parameter = this.getParameters().find((param) => param.name === name);
    if (parameter) {
      parameter.value = value;
    }
    return this;
  };

  unrequireParameters = (parameterNames: Set<string>) => {
    this.getParameters()
      .filter((param) => parameterNames.has(param.name) && param.required)
      .forEach((param) => {
        delete param.required;
      });
    return this;
  };
}
