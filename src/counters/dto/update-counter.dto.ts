// src/counters/dto/update-counter.dto.ts
import { PartialType } from '@nestjs/mapped-types';
import { CreateCounterDto } from './create-counter.dto';

// PartialType makes all properties of CreateCounterDto optional
export class UpdateCounterDto extends PartialType(CreateCounterDto) {}
