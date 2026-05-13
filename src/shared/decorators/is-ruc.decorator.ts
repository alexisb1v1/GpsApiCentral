import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isValidRuc } from '../utils/ruc.util';

@ValidatorConstraint({ name: 'isRuc', async: false })
export class IsRucConstraint implements ValidatorConstraintInterface {
  validate(ruc: any) {
    return isValidRuc(ruc);
  }

  defaultMessage() {
    return 'El RUC ingresado no es válido según los estándares de SUNAT';
  }
}

export function IsRuc(validationOptions?: ValidationOptions) {
  return function (object: Object, propertyName: string) {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      constraints: [],
      validator: IsRucConstraint,
    });
  };
}
