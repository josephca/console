import * as React from 'react';
import * as _ from 'lodash';
import { TextInput } from '@patternfly/react-core';
import { toShallowJS } from '../../../../utils/immutable';
import { FormFieldRow } from '../../form/form-field-row';
import { FormField, FormFieldType } from '../../form/form-field';
import { VMWizardStorage } from '../../types';
import { VolumeWrapper } from '../../../../k8s/wrapper/vm/volume-wrapper';
import { DataVolumeSourceType, VolumeType } from '../../../../constants/vm/storage';
import { DataVolumeWrapper } from '../../../../k8s/wrapper/vm/data-volume-wrapper';
import { ContainerSourceHelp } from '../../../form/helper/container-source-help';

export const ContainerSource: React.FC<ContainerSourceProps> = React.memo(
  ({ field, provisionSourceStorage, onProvisionSourceStorageChange }) => {
    const storage: VMWizardStorage = toShallowJS(provisionSourceStorage);
    const volumeWrapper = new VolumeWrapper(storage?.volume);

    let isDisabled = true;
    let value: string;
    let onChange;
    if (volumeWrapper.getType() === VolumeType.CONTAINER_DISK) {
      isDisabled = false;
      value = volumeWrapper.getContainerImage();
      onChange = (image) =>
        onProvisionSourceStorageChange({
          ...storage,
          volume: new VolumeWrapper(storage?.volume, true)
            .appendTypeData({ image }, false)
            .asResource(),
        });
    } else if (volumeWrapper.getType() === VolumeType.DATA_VOLUME) {
      const dataVolumeWrapper = new DataVolumeWrapper(storage?.dataVolume);
      if (dataVolumeWrapper.getType() === DataVolumeSourceType.REGISTRY) {
        isDisabled = false;
        value = dataVolumeWrapper.getContainer();
        onChange = (url) =>
          onProvisionSourceStorageChange({
            ...storage,
            dataVolume: new DataVolumeWrapper(storage?.dataVolume, true)
              .appendTypeData({ url }, false)
              .asResource(),
          });
      }
    }

    return (
      <FormFieldRow
        field={field}
        fieldType={FormFieldType.TEXT}
        validation={_.get(storage, ['validation', 'validations', 'container'])}
      >
        <FormField value={value} isDisabled={isDisabled}>
          <TextInput onChange={onChange} />
        </FormField>
        <ContainerSourceHelp />
      </FormFieldRow>
    );
  },
);

type ContainerSourceProps = {
  field: any;
  provisionSourceStorage: any;
  onProvisionSourceStorageChange: (provisionSourceStorage: any) => void;
};
